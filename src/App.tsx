/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { AuthUser, AppState, Settings, SeatInfo, Trip } from './types';
import { uid, emptySeats, seatStats } from './utils';
import { db, auth, handleFirestoreError, OperationType } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, setDoc, updateDoc, deleteDoc, collection, onSnapshot, getDoc, getDocs, serverTimestamp, query, where } from 'firebase/firestore';

// Core layout & view elements
import Topbar from './components/Topbar';
import Sidebar from './components/Sidebar';
import SearchOverlay from './components/SearchOverlay';
import TicketPrint from './components/TicketPrint';

// Custom views
import DashboardView from './components/DashboardView';
import PassengersView from './components/PassengersView';
import TripsView from './components/TripsView';
import ReportsView from './components/ReportsView';
import BackupView from './components/BackupView';
import SettingsView from './components/SettingsView';
import UserManagementView from './components/UserManagementView';
import DeveloperPanel from './components/DeveloperPanel';
import DeveloperWelcomeSplash from './components/developer/DeveloperWelcomeSplash';

// Auth placeholding screens
import Login from './components/Login';
import WaitingApproval from './components/WaitingApproval';
import NoMemberId from './components/NoMemberId';

// Modals
import { BookingModal, TripModal, ConfirmModal } from './components/Modals';
import { ZH_OFFICIAL_LOGO } from './assets/logo';

const STORAGE_KEY = 'counterpro_data_v1';
const AUTH_STORAGE_KEY = 'counterpro_auth_v1';

// Helper functions for user-isolated active trip persistence
const getSavedActiveTripId = (uid: string | undefined): string => {
  if (!uid) return '';
  try {
    return localStorage.getItem(`counterpro_active_trip_${uid}`) || '';
  } catch {
    return '';
  }
};

const persistActiveTripId = (uid: string | undefined, tripId: string) => {
  if (!uid || !tripId) return;
  try {
    localStorage.setItem(`counterpro_active_trip_${uid}`, tripId);
  } catch (e) {
    console.error('Failed to save active trip to localStorage', e);
  }
};

const clearSavedActiveTripId = (uid: string | undefined) => {
  if (!uid) return;
  try {
    localStorage.removeItem(`counterpro_active_trip_${uid}`);
  } catch (e) {}
};

// Initial state generators matching the original HTML exactly
function defaultSettings(): Settings {
  return {
    busName: 'Green Express',
    heading: 'Dhaka Counter — Saidabad',
    route: 'Dhaka → Noakhali',
    date: new Date().toISOString().slice(0, 10),
    time: '21:30',
    theme: 'light',
    logo: ZH_OFFICIAL_LOGO,
    devLine: 'ZIHAN | +8801830343515',
    ticketHeader: '',
    ticketFooter: 'Thank you for travelling with us',
    printWidthMm: 80,
  };
}

function defaultState(): AppState {
  const t1 = uid('trip');
  return {
    settings: defaultSettings(),
    activeTripId: t1,
    trips: {
      [t1]: {
        id: t1,
        route: 'Dhaka → Noakhali',
        date: new Date().toISOString().slice(0, 10),
        time: '21:30',
        busName: 'Green Express',
        seats: emptySeats(),
      },
    },
  };
}

export default function App() {
  // 1. App Database State (Preserves localStorage counter states)
  const [appState, setAppState] = useState<AppState>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      if (!parsed.trips || !parsed.settings) return defaultState();
      parsed.settings = Object.assign({}, defaultSettings(), parsed.settings);
      return parsed;
    } catch (e) {
      console.error('Failed to load state', e);
      return defaultState();
    }
  });

  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => {
    try {
      const raw = localStorage.getItem(AUTH_STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  });

  // Local state for active trip strictly isolated to the authenticated user UID
  const [localActiveTripId, setLocalActiveTripId] = useState<string>(() => {
    try {
      const savedUserRaw = localStorage.getItem(AUTH_STORAGE_KEY);
      if (savedUserRaw) {
        const parsedUser = JSON.parse(savedUserRaw);
        if (parsedUser?.uid) {
          const savedTrip = getSavedActiveTripId(parsedUser.uid);
          if (savedTrip) return savedTrip;
        }
      }
    } catch {}
    return '';
  });

  const activeTripIdRef = useRef<string>(localActiveTripId);
  useEffect(() => {
    activeTripIdRef.current = localActiveTripId;
  }, [localActiveTripId]);

  // 2. Authentication State
  const [fbUser, setFbUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [sessionTerminatedNotice, setSessionTerminatedNotice] = useState<string>('');
  const [showDeveloperSplash, setShowDeveloperSplash] = useState<boolean>(() => {
    return sessionStorage.getItem('trigger_dev_splash') === 'true';
  });
  const [globalSystemLogo, setGlobalSystemLogo] = useState<string>(ZH_OFFICIAL_LOGO);

  // Real-time listener for global Developer System Config (Brand Logo, Policies)
  useEffect(() => {
    const configDocRef = doc(db, 'settings', 'developer_system_config');
    const unsubConfig = onSnapshot(
      configDocRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data.appLogo && typeof data.appLogo === 'string' && data.appLogo.trim() !== '') {
            setGlobalSystemLogo(data.appLogo);
          } else {
            setGlobalSystemLogo(ZH_OFFICIAL_LOGO);
          }
        }
      },
      (err) => {
        console.warn('System config snapshot note:', err);
      }
    );
    return () => unsubConfig();
  }, []);

  // Track Firebase Auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setFbUser(firebaseUser);
      setAuthLoading(false);
      if (!firebaseUser) {
        setCurrentUser(null);
        setLocalActiveTripId('');
        activeTripIdRef.current = '';
      } else {
        const savedTrip = getSavedActiveTripId(firebaseUser.uid);
        if (savedTrip) {
          setLocalActiveTripId(savedTrip);
          activeTripIdRef.current = savedTrip;
          setAppState(prev => ({ ...prev, activeTripId: savedTrip }));
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Real-time listener for Auth State change and user snapshot updates from Firestore
  useEffect(() => {
    if (!fbUser) return;

    const userRef = doc(db, 'users', fbUser.uid);

    // Automatically check and create user document if it does not already exist
    const ensureUserDocExists = async () => {
      try {
        let docSnap;
        try {
          docSnap = await getDoc(userRef);
        } catch (getErr) {
          handleFirestoreError(getErr, OperationType.GET, `users/${fbUser.uid}`);
          return;
        }

        if (!docSnap.exists()) {
          const resolvedName = fbUser.displayName || fbUser.email?.split('@')[0] || 'User';
          const isAdmin = fbUser.email === 'zihanalam.at@gmail.com';
          const newUserObj = {
            uid: fbUser.uid,
            email: fbUser.email || '',
            displayName: resolvedName,
            name: resolvedName,
            photoURL: fbUser.photoURL || null,
            memberId: isAdmin ? 'ADM-2026-0001' : '',
            loginId: isAdmin ? 'ADM-2026-0001' : '', // For compatibility with existing loginId checks
            approved: isAdmin ? true : false,
            isApproved: isAdmin ? true : false,
            role: isAdmin ? 'admin' : 'member',
            createdAt: serverTimestamp(),
          };
          try {
            await setDoc(userRef, newUserObj);
          } catch (writeErr) {
            handleFirestoreError(writeErr, OperationType.WRITE, `users/${fbUser.uid}`);
          }
        }
      } catch (err) {
        console.error('Failed to automatically check or create user document in Firestore:', err);
      }
    };

    const isRegistering = sessionStorage.getItem('is_registering') === 'true' || localStorage.getItem('is_registering') === 'true';
    const hasPendingReg = sessionStorage.getItem('pending_agency_reg') !== null || localStorage.getItem('pending_agency_reg') !== null;
    const isAdmin = fbUser.email === 'zihanalam.at@gmail.com';
    if (isAdmin && !isRegistering && !hasPendingReg) {
      ensureUserDocExists();
    }

    const unsubUser = onSnapshot(userRef, (snapshot) => {
      const isAdmin = fbUser.email === 'zihanalam.at@gmail.com';
      if (snapshot.exists()) {
        const data = snapshot.data();
        const info = data.information || {};
        const mgmt = data.management || {};

        const mgmtStatus = mgmt.accountStatus;
        const topStatus = data.accountStatus;
        const stringStatus = data.status;

        const isSuspended = 
          mgmtStatus === false || 
          topStatus === false || 
          mgmtStatus === 'Suspended' || 
          mgmtStatus === 'DEACTIVE' || 
          mgmtStatus === 'blocked' || 
          stringStatus === 'Suspended' || 
          stringStatus === 'DEACTIVE' || 
          stringStatus === 'blocked';

        if (isSuspended) {
          signOut(auth).catch(err => console.error('Error signing out suspended user:', err));
          setCurrentUser(null);
          showToast('আপনার অ্যাকাউন্টটি সাসপেন্ড করা হয়েছে, অনুগ্রহ করে ডেভেলপারের সাথে যোগাযোগ করুন।', true);
          return;
        }

        const loginId = mgmt.agencyCode || data.agencyCode || data.loginId || data.memberId || (isAdmin ? 'ADM-2026-0001' : '');
        const agencyName = data.agencyName || info.agencyName || data.displayName || data.name || fbUser.email?.split('@')[0] || 'User';
        const adminName = info.adminName || data.adminName || data.displayName || data.name || 'Admin';
        const memberIdAssigned = isAdmin || loginId.trim() !== '';

        const isReg = sessionStorage.getItem('is_registering') === 'true';
        const hasPendingReg = sessionStorage.getItem('pending_agency_reg') !== null;

        const isDeveloperUser = fbUser.email === 'zihanalam.at@gmail.com' || data.role === 'developer' || data.role === 'admin';
        const roleVal = data.role === 'developer' ? 'developer' : (isDeveloperUser ? 'developer' : (data.role || 'agency'));

        // --- SEPARATE SESSION ARCHITECTURE & ENFORCEMENT ---
        if (isDeveloperUser) {
          // DEVELOPER PANEL: Strict Single Active Session Enforcement
          const devServerSessionId = data.activeDevSessionId || data.activeSessionId;
          const devLocalSessionKey = `counterpro_developer_session_${fbUser.uid}`;
          const devLocalSessionId = localStorage.getItem(devLocalSessionKey) || localStorage.getItem(`counterpro_session_${fbUser.uid}`);
          const isDevLoggingIn = sessionStorage.getItem('is_developer_logging_in') === 'true';
          const pendingDevSessionId = sessionStorage.getItem('pending_dev_session_id');

          if (isDevLoggingIn) {
            // Active login in progress on this device: adopt new session ID and do not kick out
            const effectiveSessionId = pendingDevSessionId || devLocalSessionId || devServerSessionId || '';
            try {
              if (effectiveSessionId) {
                localStorage.setItem(devLocalSessionKey, effectiveSessionId);
                localStorage.setItem(`counterpro_session_${fbUser.uid}`, effectiveSessionId);
              }
            } catch (e) {}
          } else if (devServerSessionId && devLocalSessionId && devLocalSessionId !== devServerSessionId) {
            // Superseded: The developer logged in from another device/browser (Device B)
            console.warn(`[DeveloperSingleSession] Session superseded for Developer UID ${fbUser.uid}. Server: ${devServerSessionId}, Local: ${devLocalSessionId}`);
            const kickMsg = 'The developer account was signed in on another device. You have been logged out. (ডেভেলপার অ্যাকাউন্টটি অন্য একটি ডিভাইসে লগইন করা হয়েছে। আপনি লগআউট হয়ে গেছেন।)';
            setSessionTerminatedNotice(kickMsg);
            localStorage.removeItem(devLocalSessionKey);
            localStorage.removeItem(`counterpro_session_${fbUser.uid}`);
            sessionStorage.removeItem('trigger_dev_splash');
            signOut(auth).catch(err => console.error('Signout error on developer session mismatch:', err));
            setCurrentUser(null);
            setAppState(defaultState());
            setLocalActiveTripId('');
            activeTripIdRef.current = '';
            setPrintedSeatIds([]);
            setCurrentView('dashboard');
            showToast('The developer account was signed in on another device. You have been logged out.', true);
            return;
          } else if (devServerSessionId && !devLocalSessionId && !isReg && !hasPendingReg) {
            // Server has an active developer session, but this client does not possess the matching developer session token
            console.warn(`[DeveloperSingleSession] Unrecognized developer session for UID ${fbUser.uid}. Server: ${devServerSessionId}`);
            const kickMsg = 'The developer account was signed in on another device. You have been logged out. (ডেভেলপার অ্যাকাউন্টটি অন্য একটি ডিভাইসে লগইন করা হয়েছে। আপনি লগআউট হয়ে গেছেন।)';
            setSessionTerminatedNotice(kickMsg);
            localStorage.removeItem(devLocalSessionKey);
            localStorage.removeItem(`counterpro_session_${fbUser.uid}`);
            sessionStorage.removeItem('trigger_dev_splash');
            signOut(auth).catch(err => console.error('Signout error on missing dev token:', err));
            setCurrentUser(null);
            setAppState(defaultState());
            setLocalActiveTripId('');
            activeTripIdRef.current = '';
            setPrintedSeatIds([]);
            setCurrentView('dashboard');
            return;
          } else if (!devServerSessionId && devLocalSessionId) {
            updateDoc(userRef, { activeDevSessionId: devLocalSessionId, activeSessionId: devLocalSessionId, lastSessionAt: serverTimestamp() }).catch(() => {});
          } else if (!devServerSessionId && !devLocalSessionId && !isReg && !hasPendingReg) {
            const newDevSessionId = `sess_dev_${Date.now()}_${Math.random().toString(36).substring(2, 11)}_${Math.random().toString(36).substring(2, 11)}`;
            try {
              localStorage.setItem(devLocalSessionKey, newDevSessionId);
              localStorage.setItem(`counterpro_session_${fbUser.uid}`, newDevSessionId);
            } catch (e) {}
            updateDoc(userRef, { activeDevSessionId: newDevSessionId, activeSessionId: newDevSessionId, lastSessionAt: serverTimestamp() }).catch(() => {});
          }
        } else {
          // USER PANEL: Independent user account session isolation
          const userLocalSessionKey = `counterpro_user_session_${fbUser.uid}`;
          const userLocalSessionId = localStorage.getItem(userLocalSessionKey) || localStorage.getItem(`counterpro_session_${fbUser.uid}`);
          const isUserLoggingIn = sessionStorage.getItem('is_user_logging_in') === 'true';
          const pendingUserSessionId = sessionStorage.getItem('pending_user_session_id');

          if (isUserLoggingIn && pendingUserSessionId) {
            try {
              localStorage.setItem(userLocalSessionKey, pendingUserSessionId);
              localStorage.setItem(`counterpro_session_${fbUser.uid}`, pendingUserSessionId);
            } catch (e) {}
          } else if (userLocalSessionId && !data.activeSessionId) {
            updateDoc(userRef, { activeSessionId: userLocalSessionId, lastSessionAt: serverTimestamp() }).catch(() => {});
          } else if (!userLocalSessionId && data.activeSessionId) {
            try {
              localStorage.setItem(userLocalSessionKey, data.activeSessionId);
              localStorage.setItem(`counterpro_session_${fbUser.uid}`, data.activeSessionId);
            } catch (e) {}
          }
        }

        const isApprovedVal = isAdmin || isDeveloperUser ? true : (mgmtStatus === true || topStatus === true || data.isApproved === true || stringStatus === 'Active' || memberIdAssigned);

        const currentActiveSessionId = isDeveloperUser
          ? (data.activeDevSessionId || data.activeSessionId || localStorage.getItem(`counterpro_developer_session_${fbUser.uid}`) || '')
          : (data.activeSessionId || localStorage.getItem(`counterpro_user_session_${fbUser.uid}`) || '');

        setCurrentUser({
          uid: fbUser.uid,
          email: fbUser.email || info.email || data.email || '',
          displayName: agencyName,
          name: adminName,
          loginId: loginId,
          agencyCode: loginId,
          agencyName: agencyName,
          agencyLocation: info.agencyLocation || data.agencyLocation || '',
          photoURL: fbUser.photoURL || data.photoURL,
          role: roleVal,
          isApproved: isApprovedVal,
          memberIdAssigned: memberIdAssigned,
          createdAt: data.createdAt,
          status: isSuspended ? 'Suspended' : (isApprovedVal ? 'Active' : 'Pending'),
          accountStatus: !isSuspended,
          activeSessionId: currentActiveSessionId,
          activeDevSessionId: isDeveloperUser ? currentActiveSessionId : undefined,
          information: info,
          management: mgmt,
        });

        if (roleVal === 'developer' && sessionStorage.getItem('trigger_dev_splash') === 'true') {
          setShowDeveloperSplash(true);
        }
      } else {
        // If user document does not exist and they are not admin:
        // Do NOT sign out if the user is in registration/email-verification flow (unverified or has pending data)
        if (!isAdmin) {
          const isReg = sessionStorage.getItem('is_registering') === 'true' || localStorage.getItem('is_registering') === 'true';
          const hasPendingReg = sessionStorage.getItem('pending_agency_reg') !== null || localStorage.getItem('pending_agency_reg') !== null;
          const isUnverified = !fbUser.emailVerified;

          if (!isReg && !hasPendingReg && !isUnverified) {
            signOut(auth).catch(err => console.error('Error signing out non-existent user:', err));
            setCurrentUser(null);
          }
          return;
        }

        // Default admin user object if doc doesn't exist yet
        setCurrentUser(prev => {
          if (prev && prev.isApproved && prev.memberIdAssigned) {
            return prev;
          }
          return {
            uid: fbUser.uid,
            email: fbUser.email || '',
            displayName: fbUser.displayName || fbUser.email?.split('@')[0] || 'User',
            name: fbUser.displayName || fbUser.email?.split('@')[0] || 'User',
            loginId: 'ADM-2026-0001',
            photoURL: fbUser.photoURL,
            role: 'admin',
            isApproved: true,
            memberIdAssigned: true,
          };
        });
      }
    }, (err) => {
      if (err.code === 'permission-denied') {
        console.log('User snapshot listener permission denied (expected on sign out).');
      } else {
        console.error('Error fetching user snapshot', err);
        handleFirestoreError(err, OperationType.GET, `users/${fbUser.uid}`);
      }
    });
    return () => unsubUser();
  }, [fbUser]);

  // Real-time listener for agency settings: users/{uid}/settings/config
  useEffect(() => {
    if (!fbUser || !currentUser || fbUser.uid !== currentUser.uid || !currentUser.isApproved || !currentUser.memberIdAssigned) return;

    const userSettingsRef = doc(db, 'users', currentUser.uid, 'settings', 'config');

    const unsubSettings = onSnapshot(userSettingsRef, async (snap) => {
      if (snap.exists()) {
        const loadedSettings = snap.data() as Settings;
        setAppState(prev => {
          const nextSettings = {
            ...defaultSettings(),
            ...loadedSettings,
          };
          const nextState = {
            ...prev,
            settings: nextSettings,
          };
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
          } catch (e) {}
          return nextState;
        });
      } else {
        try {
          const agencyKey = currentUser.agencyName || currentUser.displayName || 'ZH Travel Management';
          let baseSettings: Settings = defaultSettings();
          const initSettings: Settings = {
            ...baseSettings,
            busName: agencyKey || baseSettings.busName || 'ZH Travel Management',
          };

          await setDoc(userSettingsRef, initSettings, { merge: true });
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `users/${currentUser.uid}/settings/config`);
        }
      }
    }, (err) => {
      if (err.code === 'permission-denied') {
        console.log('Settings snapshot listener permission denied (expected on sign out).');
      } else {
        handleFirestoreError(err, OperationType.GET, `users/${currentUser.uid}/settings/config`);
      }
    });

    return () => unsubSettings();
  }, [fbUser?.uid, currentUser?.uid, currentUser?.isApproved, currentUser?.memberIdAssigned]);

  // Real-time listener for strictly isolated user trips: users/{userId}/trips/{tripId}
  useEffect(() => {
    if (!fbUser || !currentUser || fbUser.uid !== currentUser.uid || !currentUser.isApproved || !currentUser.memberIdAssigned) return;

    const userTripsRef = collection(db, 'users', currentUser.uid, 'trips');

    const unsubTrips = onSnapshot(userTripsRef, async (snap) => {
      const fetchedTrips: Record<string, Trip> = {};
      snap.forEach((docSnap) => {
        fetchedTrips[docSnap.id] = docSnap.data() as Trip;
      });

      if (Object.keys(fetchedTrips).length === 0) {
        const agencyKey = currentUser.agencyName || currentUser.displayName || 'ZH Travel';
        // Check for existing trips under data/{agencyKey}/trips with matching ownerUid to migrate
        try {
          const legacyDataTripsRef = collection(db, 'data', agencyKey, 'trips');
          const qLegacy = query(legacyDataTripsRef, where('ownerUid', '==', currentUser.uid));
          const legacySnap = await getDocs(qLegacy);

          if (!legacySnap.empty) {
            for (const legDoc of legacySnap.docs) {
              const legData = legDoc.data() as Trip;
              const tripPayload: Trip = {
                ...legData,
                id: legDoc.id,
                tripName: legData.route || legData.tripName || 'Trip',
                route: legData.route || legData.tripName || 'Trip',
                busName: agencyKey || legData.busName || 'ZH Travel',
                agencyName: agencyKey,
                ownerUid: currentUser.uid,
                updatedAt: Date.now(),
              };
              await setDoc(doc(db, 'users', currentUser.uid, 'trips', legDoc.id), tripPayload);
            }
            return;
          }
        } catch (migErr) {
          console.warn('Trips legacy check note:', migErr);
        }

        // Seed 1 default trip isolated exclusively to this user
        const dState = defaultState();
        for (const [id, trip] of Object.entries(dState.trips)) {
          const payload: Trip = {
            ...trip,
            id,
            tripName: trip.route,
            busName: agencyKey || trip.busName,
            agencyName: agencyKey,
            ownerUid: currentUser.uid,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          setDoc(doc(db, 'users', currentUser.uid, 'trips', id), payload).catch((err) => {
            handleFirestoreError(err, OperationType.WRITE, `users/${currentUser.uid}/trips/${id}`);
          });
        }
      } else {
        // Determine active trip: strictly preserve currently selected trip if it still exists in fetchedTrips,
        // otherwise load from user-isolated storage, or fallback to the first trip.
        const currentActive = activeTripIdRef.current || getSavedActiveTripId(currentUser.uid);
        let nextActiveId = currentActive;

        if (!nextActiveId || !fetchedTrips[nextActiveId]) {
          const savedTrip = getSavedActiveTripId(currentUser.uid);
          if (savedTrip && fetchedTrips[savedTrip]) {
            nextActiveId = savedTrip;
          } else {
            nextActiveId = Object.keys(fetchedTrips)[0] || '';
          }
        }

        if (nextActiveId) {
          persistActiveTripId(currentUser.uid, nextActiveId);
          activeTripIdRef.current = nextActiveId;
          setLocalActiveTripId(nextActiveId);
        }

        setAppState(prev => ({
          ...prev,
          activeTripId: nextActiveId,
          trips: fetchedTrips,
        }));
      }
    }, (err) => {
      if (err.code === 'permission-denied') {
        console.log('Trips snapshot listener permission denied (expected on sign out).');
      } else {
        handleFirestoreError(err, OperationType.GET, `users/${currentUser.uid}/trips`);
      }
    });

    return () => unsubTrips();
  }, [fbUser?.uid, currentUser?.uid, currentUser?.isApproved, currentUser?.memberIdAssigned]);

  // 3. View Routing state
  const [currentView, setCurrentView] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // 4. Overlays & Searches
  const [searchOpen, setSearchOpen] = useState(false);

  // 5. Modals State
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [activeSeatId, setActiveSeatId] = useState<string | null>(null);

  const [tripModalOpen, setTripModalOpen] = useState(false);
  const [activeTripIdForModal, setActiveTripIdForModal] = useState<string | null>(null);

  // Confirmation Modal state
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{
    title: string;
    text: string;
    okLabel?: string;
    onConfirm: () => void;
  }>({
    title: '',
    text: '',
    onConfirm: () => {},
  });

  // 6. Thermal Ticket Printing state
  const [printedSeatIds, setPrintedSeatIds] = useState<string[]>([]);

  // 7. Toast Alerts state
  const [toastMessage, setToastMessage] = useState('');
  const [toastIsError, setToastIsError] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [selectedPassengerKeys, setSelectedPassengerKeys] = useState<Set<string>>(new Set());

  // Save changes to localStorage (offline cache backup)
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
    } catch (e) {
      console.error('Failed to save state', e);
    }
  }, [appState]);

  // Sync current user to storage
  useEffect(() => {
    try {
      if (currentUser) {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(currentUser));
      } else {
        localStorage.removeItem(AUTH_STORAGE_KEY);
      }
    } catch (e) {
      console.error('Failed to save auth state', e);
    }
  }, [currentUser]);

  // Synchronize CSS custom properties with selected POS thermal width
  useEffect(() => {
    const mm = appState.settings.printWidthMm || 80;
    const px = Math.max(160, Math.min(420, Math.round(mm * 3.78)));
    document.documentElement.style.setProperty('--ticket-w', `${px}px`);
    document.documentElement.setAttribute('data-theme', appState.settings.theme || 'dark');
  }, [appState.settings.printWidthMm, appState.settings.theme]);

  // Toast trigger
  const toastTimeoutRef = useRef<any>(null);

  const showToast = (msg: string, isError = false) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToastMessage(msg);
    setToastIsError(isError);
    setToastVisible(true);
    toastTimeoutRef.current = setTimeout(() => {
      setToastVisible(false);
    }, 3000);
  };

  // Switch Themes
  const toggleTheme = async () => {
    const nextTheme = appState.settings.theme === 'dark' ? 'light' : 'dark';
    try {
      if (currentUser?.uid) {
        const userSettingsRef = doc(db, 'users', currentUser.uid, 'settings', 'config');
        await updateDoc(userSettingsRef, { theme: nextTheme }).catch(() => setDoc(userSettingsRef, { theme: nextTheme }, { merge: true }));
      }
      showToast(`Switched to ${nextTheme} mode`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${currentUser?.uid}/settings/config`);
      showToast('Failed to toggle theme', true);
    }
  };

  // Auth Callbacks
  const handleLoginSuccess = (user: AuthUser) => {
    setSessionTerminatedNotice('');
    setCurrentUser(user);
    if (user.role === 'developer' || user.role === 'admin' || user.email === 'zihanalam.at@gmail.com') {
      setShowDeveloperSplash(true);
      sessionStorage.setItem('trigger_dev_splash', 'true');
      setCurrentView('users-manage');
      showToast(`Welcome to Developer Panel, ${user.displayName || 'Developer'}`);
    } else {
      showToast(`Signed in successfully as ${user.displayName}`);
    }
  };

  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const executeLogout = async () => {
    try {
      sessionStorage.removeItem('trigger_dev_splash');
      sessionStorage.removeItem('is_registering');
      sessionStorage.removeItem('pending_agency_reg');
      setShowDeveloperSplash(false);

      if (currentUser?.uid) {
        try {
          localStorage.removeItem(`counterpro_developer_session_${currentUser.uid}`);
          localStorage.removeItem(`counterpro_user_session_${currentUser.uid}`);
          localStorage.removeItem(`counterpro_session_${currentUser.uid}`);
          const userDocRef = doc(db, 'users', currentUser.uid);
          await updateDoc(userDocRef, {
            activeDevSessionId: '',
            activeSessionId: '',
            lastLogout: serverTimestamp(),
          });
        } catch (sessErr) {
          console.warn('Session logout invalidate note:', sessErr);
        }
      }

      await signOut(auth);
      setCurrentUser(null);
      setAppState(defaultState());
      setLocalActiveTripId('');
      activeTripIdRef.current = '';
      setPrintedSeatIds([]);
      setCurrentView('dashboard');
      setShowLogoutConfirm(false);
      showToast('Signed out successfully');
    } catch (err) {
      console.error('Error signing out:', err);
      showToast('Failed to sign out', true);
    }
  };

  // Explicit user trip selection handler
  const handleSelectTrip = (tripId: string) => {
    if (!tripId || !appState.trips[tripId]) return;
    setLocalActiveTripId(tripId);
    activeTripIdRef.current = tripId;
    setAppState(prev => ({ ...prev, activeTripId: tripId }));
    if (currentUser?.uid) {
      persistActiveTripId(currentUser.uid, tripId);
      const userSettingsRef = doc(db, 'users', currentUser.uid, 'settings', 'config');
      updateDoc(userSettingsRef, { activeTripId: tripId }).catch(() => {});
    }
    setCurrentView('dashboard');
    const routeName = appState.trips[tripId]?.route || 'Trip';
    showToast(`Active trip set to: ${routeName}`);
  };

  // Active Trip selectors
  const activeTrip = appState.trips[appState.activeTripId] || Object.values(appState.trips)[0];

  if (!activeTrip) {
    return <div className="p-8 text-center text-[var(--text)]">Initializing Application Database...</div>;
  }

  // Modals action bindings
  const openBookingModal = (seatId: string) => {
    setActiveSeatId(seatId);
    setBookingModalOpen(true);
  };

  const saveBooking = async (seatId: string, info: SeatInfo) => {
    if (!currentUser?.uid) return;
    try {
      const tripId = appState.activeTripId;
      const userTripRef = doc(db, 'users', currentUser.uid, 'trips', tripId);

      const seatUpdate = {
        [`seats.${seatId}`]: {
          ...info,
          updatedAt: Date.now()
        },
        updatedAt: Date.now(),
      };

      await updateDoc(userTripRef, seatUpdate);

      setBookingModalOpen(false);
      showToast(`Seat ${seatId} saved successfully`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${currentUser.uid}/trips/${appState.activeTripId}`);
      showToast(`Failed to save seat ${seatId}`, true);
    }
  };

  const triggerCancelBooking = (seatId: string) => {
    if (!currentUser?.uid) return;
    setConfirmConfig({
      title: `Cancel seat ${seatId}?`,
      text: 'This will mark the seat as cancelled and free it up for re-booking.',
      okLabel: 'Cancel Booking',
      onConfirm: async () => {
        try {
          const tripId = appState.activeTripId;
          const userTripRef = doc(db, 'users', currentUser.uid, 'trips', tripId);
          const currentSeat = activeTrip.seats[seatId] || {};

          const seatUpdate = {
            [`seats.${seatId}`]: {
              ...currentSeat,
              status: 'cancelled',
              updatedAt: Date.now()
            },
            updatedAt: Date.now(),
          };

          await updateDoc(userTripRef, seatUpdate);

          setBookingModalOpen(false);
          setConfirmModalOpen(false);
          showToast(`Booking for seat ${seatId} cancelled`);
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `users/${currentUser?.uid}/trips/${appState.activeTripId}`);
          showToast(`Failed to cancel booking`, true);
        }
      },
    });
    setConfirmModalOpen(true);
  };

  const triggerPrintTicket = (seatId: string) => {
    setPrintedSeatIds([seatId]);
    setTimeout(() => {
      window.print();
    }, 120);
  };

  const triggerPrintBulkTickets = (seatIds: string[]) => {
    setPrintedSeatIds(seatIds);
    setTimeout(() => {
      window.print();
    }, 120);
  };

  const handleGlobalSearchResultClick = (tripId: string, seatId: string) => {
    if (tripId && appState.trips[tripId]) {
      setLocalActiveTripId(tripId);
      activeTripIdRef.current = tripId;
      setAppState(prev => ({ ...prev, activeTripId: tripId }));
      if (currentUser?.uid) {
        persistActiveTripId(currentUser.uid, tripId);
      }
    }
    setSearchOpen(false);
    setCurrentView('dashboard');
    setTimeout(() => {
      openBookingModal(seatId);
    }, 150);
  };

  // Trip action bindings
  const openTripModal = (tripId: string | null) => {
    setActiveTripIdForModal(tripId);
    setTripModalOpen(true);
  };

  const saveTrip = async (
    id: string | null,
    details: { route: string; date: string; time: string; busName: string }
  ) => {
    if (!currentUser?.uid) return;
    try {
      const agencyName = currentUser.agencyName || details.busName || 'ZH Travel';
      if (id) {
        const userTripRef = doc(db, 'users', currentUser.uid, 'trips', id);
        const updatePayload = {
          ...details,
          tripName: details.route,
          agencyName: agencyName,
          busName: details.busName || agencyName,
          ownerUid: currentUser.uid,
          updatedAt: Date.now(),
        };
        await updateDoc(userTripRef, updatePayload);
      } else {
        const newId = uid('trip');
        const userTripRef = doc(db, 'users', currentUser.uid, 'trips', newId);
        const newTrip: Trip = {
          id: newId,
          tripName: details.route,
          ...details,
          busName: details.busName || agencyName,
          agencyName: agencyName,
          seats: emptySeats(),
          ownerUid: currentUser.uid,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        await setDoc(userTripRef, newTrip);
        setLocalActiveTripId(newId);
        activeTripIdRef.current = newId;
        setAppState(prev => ({ ...prev, activeTripId: newId }));
        if (currentUser?.uid) {
          persistActiveTripId(currentUser.uid, newId);
        }
      }
      setTripModalOpen(false);
      showToast('Trip saved successfully');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${currentUser?.uid}/trips/${id || 'new'}`);
      showToast('Failed to save trip', true);
    }
  };

  const triggerDeleteTrip = (tripId: string) => {
    if (Object.keys(appState.trips).length <= 1) {
      showToast('At least one trip must remain', true);
      return;
    }
    if (!currentUser?.uid) return;

    const trip = appState.trips[tripId];
    const routeName = trip?.route ? ` "${trip.route}"` : '';

    setConfirmConfig({
      title: `Delete trip${routeName}?`,
      text: 'All seat and passenger data for this trip will be permanently removed.',
      okLabel: 'Delete Trip',
      onConfirm: async () => {
        try {
          const userTripRef = doc(db, 'users', currentUser.uid, 'trips', tripId);
          await deleteDoc(userTripRef);
          
          setAppState(prev => {
            const updatedTrips = { ...prev.trips };
            delete updatedTrips[tripId];
            let nextActiveId = prev.activeTripId;
            if (prev.activeTripId === tripId) {
              nextActiveId = Object.keys(updatedTrips)[0] || '';
              setLocalActiveTripId(nextActiveId);
              activeTripIdRef.current = nextActiveId;
              if (currentUser?.uid && nextActiveId) {
                persistActiveTripId(currentUser.uid, nextActiveId);
              }
            }
            return {
              ...prev,
              activeTripId: nextActiveId,
              trips: updatedTrips,
            };
          });
          setTripModalOpen(false);
          setConfirmModalOpen(false);
          showToast('Trip deleted successfully');
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `users/${currentUser?.uid}/trips/${tripId}`);
          showToast('Failed to delete trip', true);
        }
      },
    });
    setConfirmModalOpen(true);
  };

  // Backup action bindings
  const handleImportBackup = (importedState: AppState) => {
    if (!currentUser?.uid) return;
    setConfirmConfig({
      title: 'Restore this backup?',
      text: 'This will replace all current trips, bookings and settings for your account on Firestore.',
      okLabel: 'Restore Data',
      onConfirm: async () => {
        try {
          const agencyKey = currentUser.agencyName || currentUser.displayName || 'ZH Travel';
          // 1. Write user settings
          const userSettingsRef = doc(db, 'users', currentUser.uid, 'settings', 'config');
          await setDoc(userSettingsRef, importedState.settings);

          // 2. Delete existing trips first
          const fetchedTrips = Object.keys(appState.trips);
          for (const id of fetchedTrips) {
            await deleteDoc(doc(db, 'users', currentUser.uid, 'trips', id)).catch(() => {});
          }

          // 3. Write imported trips
          for (const [id, trip] of Object.entries(importedState.trips)) {
            const tripObj: Trip = {
              ...trip,
              tripName: trip.route,
              agencyName: agencyKey,
              busName: trip.busName || agencyKey,
              ownerUid: currentUser.uid,
              updatedAt: Date.now(),
            };
            await setDoc(doc(db, 'users', currentUser.uid, 'trips', id), tripObj);
          }

          setConfirmModalOpen(false);
          showToast('Backup restored successfully to your account');
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `users/${currentUser?.uid}/backup/restore`);
          showToast('Failed to restore backup', true);
        }
      },
    });
    setConfirmModalOpen(true);
  };

  const triggerResetAll = () => {
    if (!currentUser?.uid) return;
    setConfirmConfig({
      title: 'Erase all data?',
      text: 'Every trip, booking and setting for your account will be permanently deleted from Firestore. This cannot be undone.',
      okLabel: 'Erase Everything',
      onConfirm: async () => {
        try {
          const agencyName = currentUser.agencyName || 'ZH Travel';
          // 1. Reset settings
          const userSettingsRef = doc(db, 'users', currentUser.uid, 'settings', 'config');
          const resetSettings: Settings = {
            ...defaultSettings(),
            busName: agencyName,
          };
          await setDoc(userSettingsRef, resetSettings);

          // 2. Delete existing trips
          const fetchedTrips = Object.keys(appState.trips);
          for (const id of fetchedTrips) {
            await deleteDoc(doc(db, 'users', currentUser.uid, 'trips', id)).catch(() => {});
          }

          // 3. Seed 1 default trip
          const dState = defaultState();
          for (const [id, trip] of Object.entries(dState.trips)) {
            const tripPayload: Trip = {
              ...trip,
              id,
              tripName: trip.route,
              busName: agencyName,
              agencyName: agencyName,
              ownerUid: currentUser.uid,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            };
            await setDoc(doc(db, 'users', currentUser.uid, 'trips', id), tripPayload);
          }

          setConfirmModalOpen(false);
          setCurrentView('dashboard');
          showToast('All your account data erased and reset');
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `users/${currentUser?.uid}/reset-all`);
          showToast('Failed to reset data', true);
        }
      },
    });
    setConfirmModalOpen(true);
  };

  const handleSaveSettings = async (updatedSettings: Settings) => {
    if (!currentUser?.uid) return;
    try {
      const newAgencyName = updatedSettings.busName?.trim() || currentUser.agencyName || 'ZH Travel Management';
      const userSettingsRef = doc(db, 'users', currentUser.uid, 'settings', 'config');
      
      const normalizedSettings: Settings = {
        ...updatedSettings,
        busName: newAgencyName,
      };

      // 1. Save settings to users/{uid}/settings/config
      await setDoc(userSettingsRef, normalizedSettings, { merge: true });

      // 2. Properly update user profile in Firestore
      const userRef = doc(db, 'users', currentUser.uid);
      const userSnap = await getDoc(userRef);
      const existingUserData = userSnap.exists() ? userSnap.data() : {};
      const existingInfo = existingUserData.information || {};

      await setDoc(userRef, {
        agencyName: newAgencyName,
        displayName: newAgencyName,
        information: {
          ...existingInfo,
          agencyName: newAgencyName,
        },
      }, { merge: true });

      // 3. Update active in-memory state and localStorage
      setAppState(prev => {
        const nextState = {
          ...prev,
          settings: normalizedSettings,
        };
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
        } catch (e) {}
        return nextState;
      });

      // 4. Update all trip documents with new agency name and bus name automatically
      for (const tripId of Object.keys(appState.trips)) {
        try {
          await updateDoc(doc(db, 'users', currentUser.uid, 'trips', tripId), {
            busName: newAgencyName,
            agencyName: newAgencyName,
            updatedAt: Date.now(),
          });
        } catch (tErr) {
          console.warn(`Trip ${tripId} auto-update on agency rename error:`, tErr);
        }
      }

      setCurrentUser(prev => {
        if (!prev) return prev;
        const nextUser: AuthUser = {
          ...prev,
          agencyName: newAgencyName,
          displayName: newAgencyName,
          information: {
            ...prev.information,
            agencyName: newAgencyName,
          },
        };
        try {
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextUser));
        } catch (e) {}
        return nextUser;
      });

      showToast('Settings saved successfully');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${currentUser?.uid}/settings/config`);
      showToast('Failed to save settings', true);
    }
  };

  // Handle Global Keys (e.g. CTRL+K or ESC)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  // Render loading state while Firebase Auth is initializing
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex flex-col items-center justify-center space-y-4" id="app-auth-loading-screen">
        <div className="w-10 h-10 border-4 border-[#10B981]/30 border-t-[#10B981] rounded-full animate-spin" id="app-auth-loader"></div>
        <p className="text-gray-400 text-xs font-mono tracking-wider">SECURE CONNECTION INITIALIZING...</p>
      </div>
    );
  }

  // Conditional Rendering Rules based on user credentials (auth state mapping)
  if (!currentUser) {
    return (
      <Login
        onLoginSuccess={handleLoginSuccess}
        currentUser={currentUser}
        onLogout={handleLogout}
        sessionTerminatedNotice={sessionTerminatedNotice}
        onClearSessionTerminatedNotice={() => setSessionTerminatedNotice('')}
        globalLogo={globalSystemLogo}
      />
    );
  }

  // Developer Role: Dedicated, completely isolated Developer Panel
  if (currentUser.role === 'developer') {
    if (showDeveloperSplash) {
      return (
        <DeveloperWelcomeSplash
          user={currentUser}
          logoSrc={globalSystemLogo}
          onComplete={() => {
            setShowDeveloperSplash(false);
            sessionStorage.removeItem('trigger_dev_splash');
          }}
        />
      );
    }

    return (
      <>
        <DeveloperPanel
          currentUser={currentUser}
          onLogout={executeLogout}
          onShowToast={showToast}
        />
        {/* Dynamic Toast alert overlay */}
        <div className={`toast ${toastVisible ? 'show' : ''} ${toastIsError ? 'error' : ''}`} id="toast">
          {toastMessage}
        </div>
      </>
    );
  }

  // State: Pending authorization review
  if (!currentUser.isApproved) {
    return <WaitingApproval currentUser={currentUser} onLogout={handleLogout} />;
  }

  // State: Approved but Member ID unlinked
  if (!currentUser.memberIdAssigned) {
    return <NoMemberId currentUser={currentUser} onLogout={handleLogout} />;
  }

  // Dynamically derive settings prioritizing saved settings busName
  const derivedSettings: Settings = {
    ...appState.settings,
    busName: appState.settings.busName || currentUser?.agencyName || 'ZH Travel Management',
    logo: globalSystemLogo || appState.settings.logo || ZH_OFFICIAL_LOGO,
  };

  // Complete approved user interface workflow (hides dashboard until auth, meets requirement 8)
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] overflow-x-hidden">
      {/* 1. Header Toolbar */}
      <Topbar
        settings={derivedSettings}
        activeTrip={activeTrip}
        onMenuToggle={() => setSidebarOpen(prev => !prev)}
        onSearchOpen={() => setSearchOpen(true)}
        onThemeToggle={toggleTheme}
        onTripsViewGoto={() => setCurrentView('trips')}
      />

      {/* 2. Global Search widget */}
      <SearchOverlay
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        trips={appState.trips}
        onResultClick={handleGlobalSearchResultClick}
      />

      {/* 3. Main Workspace Area */}
      <div className="app-shell">
        <Sidebar
          currentView={currentView}
          onViewChange={(view) => {
            setCurrentView(view);
            setSidebarOpen(false);
          }}
          activeTrip={activeTrip}
          onLogout={handleLogout}
          sidebarOpen={sidebarOpen}
          onCloseSidebar={() => setSidebarOpen(false)}
          currentUser={currentUser}
        />

        <main className="main-content">
          {currentView === 'dashboard' && (
            <DashboardView
              settings={derivedSettings}
              trip={activeTrip}
              onBookSeatClick={openBookingModal}
              onViewChange={setCurrentView}
            />
          )}

          {currentView === 'passengers' && (
            <PassengersView
              trip={activeTrip}
              onEditSeat={openBookingModal}
              onPrintSeat={triggerPrintTicket}
              onPrintBulkSeats={triggerPrintBulkTickets}
              selectedPassengerKeys={selectedPassengerKeys}
              setSelectedPassengerKeys={setSelectedPassengerKeys}
            />
          )}

          {currentView === 'trips' && (
            <TripsView
              trips={appState.trips}
              activeTripId={appState.activeTripId}
              onSelectTrip={handleSelectTrip}
              onEditTrip={openTripModal}
              onDeleteTrip={triggerDeleteTrip}
            />
          )}

          {currentView === 'reports' && (
            <ReportsView trips={appState.trips} activeTrip={activeTrip} />
          )}

          {currentView === 'users-manage' && (
            <UserManagementView
              currentUser={currentUser}
              onShowToast={showToast}
            />
          )}

          {currentView === 'backup' && (
            <BackupView
              state={appState}
              onImportBackup={handleImportBackup}
              onResetAll={triggerResetAll}
              onShowToast={showToast}
              onReorganizeFirebase={async () => {
                if (!currentUser?.uid) return;
                try {
                  const userSettingsRef = doc(db, 'users', currentUser.uid, 'settings', 'config');
                  await setDoc(userSettingsRef, appState.settings, { merge: true });
                  showToast('ডাটাবেজ সিঙ্ক সফল হয়েছে!');
                } catch (err) {
                  showToast('সিঙ্ক করতে সমস্যা হয়েছে', true);
                }
              }}
            />
          )}

          {currentView === 'settings' && (
            <SettingsView
              settings={derivedSettings}
              onSaveSettings={handleSaveSettings}
              onShowToast={showToast}
              currentUser={currentUser}
            />
          )}
        </main>
      </div>

      {/* 4. Modular Dialogs */}
      <BookingModal
        isOpen={bookingModalOpen}
        onClose={() => setBookingModalOpen(false)}
        seatId={activeSeatId}
        seatInfo={activeSeatId ? activeTrip.seats[activeSeatId] : undefined}
        onSaveBooking={saveBooking}
        onCancelBooking={triggerCancelBooking}
        onPrintTicket={triggerPrintTicket}
      />

      <TripModal
        isOpen={tripModalOpen}
        onClose={() => setTripModalOpen(false)}
        tripId={activeTripIdForModal}
        tripInfo={activeTripIdForModal ? appState.trips[activeTripIdForModal] : undefined}
        defaultBusName={derivedSettings.busName}
        onSaveTrip={saveTrip}
        onDeleteTrip={triggerDeleteTrip}
      />

      <ConfirmModal
        isOpen={confirmModalOpen}
        title={confirmConfig.title}
        text={confirmConfig.text}
        okLabel={confirmConfig.okLabel}
        onConfirm={confirmConfig.onConfirm}
        onCancel={() => setConfirmModalOpen(false)}
      />

      {/* 5. Dynamic Toast alert overlay */}
      <div className={`toast ${toastVisible ? 'show' : ''} ${toastIsError ? 'error' : ''}`} id="toast">
        {toastMessage}
      </div>

      {/* 6. Thermal Print Document Area (hidden on screen, only visible in print output) */}
      <TicketPrint settings={derivedSettings} trip={activeTrip} printedSeatIds={printedSeatIds} />

      {/* Logout Confirmation Dialog */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="w-full max-w-sm p-6 bg-[var(--bg-elev)] border border-[var(--border)] rounded-2xl shadow-2xl relative text-center">
            <h2 className="text-lg font-bold text-[var(--text)] mb-2 font-display uppercase tracking-tight">Confirm Logout</h2>
            <p className="text-xs text-[var(--text-dim)] mb-6 leading-relaxed">Are you sure you want to logout?</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="w-1/2 btn btn-ghost py-3 rounded-xl font-bold transition-all text-[var(--text-dim)] border border-[var(--border)] hover:bg-[var(--panel-2)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeLogout}
                className="w-1/2 btn btn-primary py-3 rounded-xl font-bold transition-all bg-red-600 hover:bg-red-700 text-white border-none"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Developer Signature credits footer */}
      <footer className="dev-footer">
        Developer:{' '}
        <a href="https://www.facebook.com/share/17GtPhx6qL/" target="_blank" rel="noopener noreferrer">
          ZIHAN ALAM
        </a>
      </footer>
    </div>
  );
}
