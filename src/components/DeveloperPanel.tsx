/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  writeBatch,
  addDoc,
  query,
  orderBy,
  limit,
  getDocs,
  getDocFromServer,
} from 'firebase/firestore';
import { sendPasswordResetEmail, signOut, onAuthStateChanged } from 'firebase/auth';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db } from '../firebase';
import { AuthUser } from '../types';
import { ZH_OFFICIAL_LOGO } from '../assets/logo';
import {
  ShieldCheck,
  Users,
  Key,
  Activity,
  Settings,
  Database,
  Building2,
  Zap,
  LogOut,
  AlertTriangle,
  FileJson,
  ChevronRight,
  UserCheck,
  UserX,
  Clock,
  Radio,
  FileText,
  RefreshCw,
  Download,
  Save,
  BadgeAlert,
  Sliders,
  Shield,
  Search,
  Bell,
  CheckCheck,
  Check,
  Trash2,
  X,
  Inbox,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import { FirestoreUserData, AgencyLicense, AuditLog, SystemConfig, DeveloperNotification } from './developer/types';
import UserManagerSection from './developer/UserManagerSection';
import AgencyLicenseSection from './developer/AgencyLicenseSection';
import ActivityLogsSection from './developer/ActivityLogsSection';
import DeveloperConfigSection from './developer/DeveloperConfigSection';
import UserDataExplorerSection from './developer/UserDataExplorerSection';

interface DeveloperPanelProps {
  currentUser: AuthUser;
  onLogout: () => void;
  onShowToast: (message: string, isError?: boolean) => void;
}

const DEFAULT_CONFIG: SystemConfig = {
  developerEmail: '',
  developerCode: '',
  maintenanceMode: false,
  maintenanceMessage: 'System undergoing scheduled maintenance. Please check back shortly.',
  allowNewRegistrations: true,
  defaultCodePrefix: 'ZH-SNT-',
  systemNotice: '',
  showNotice: false,
  sessionTimeoutMinutes: 120,
  appLogo: '',
};

export default function DeveloperPanel({
  currentUser,
  onLogout,
  onShowToast,
}: DeveloperPanelProps) {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'userData' | 'licenses' | 'activity' | 'config' | 'database'>('dashboard');

  // Selected User for User Data Explorer deep inspect
  const [explorerSelectedUserId, setExplorerSelectedUserId] = useState<string | null>(null);

  // Dynamic Firebase State
  const [usersList, setUsersList] = useState<FirestoreUserData[]>([]);
  const [licenses, setLicenses] = useState<AgencyLicense[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [systemConfig, setSystemConfig] = useState<SystemConfig>(DEFAULT_CONFIG);
  const [notifications, setNotifications] = useState<DeveloperNotification[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingLicenses, setLoadingLicenses] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [loadingNotifications, setLoadingNotifications] = useState(true);

  // UI State for Notification Dropdown & Logout Modal
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);
  const [showLogoutConfirmModal, setShowLogoutConfirmModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // States for actions
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [sendingResetId, setSendingResetId] = useState<string | null>(null);
  const [isActivatingAll, setIsActivatingAll] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);

  // Delete User Modal
  const [userToDelete, setUserToDelete] = useState<FirestoreUserData | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Audit Log Filter State
  const [logFilterAction, setLogFilterAction] = useState<string>('all');
  const [logSearch, setLogSearch] = useState('');

  // Database Management Stats
  const [pingLatency, setPingLatency] = useState<number | null>(null);
  const [isPinging, setIsPinging] = useState(false);
  const [refreshingCounts, setRefreshingCounts] = useState(false);

  // Ensure Developer Session validity on mount & state change
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (fbUser) => {
      if (!fbUser) {
        onLogout();
      }
    });
    return () => unsubAuth();
  }, [onLogout]);

  // Dynamic Listener for Real-time Developer Notifications (e.g. New User Registrations)
  useEffect(() => {
    try {
      const notifRef = collection(db, 'developer_notifications');
      const qNotif = query(notifRef, orderBy('createdAt', 'desc'), limit(100));
      const unsubNotif = onSnapshot(
        qNotif,
        (snap) => {
          const list: DeveloperNotification[] = [];
          snap.forEach((d) => {
            list.push({ id: d.id, ...d.data() } as DeveloperNotification);
          });
          setNotifications(list);
          setLoadingNotifications(false);
        },
        (err) => {
          console.warn('developer_notifications listener notice:', err);
          setLoadingNotifications(false);
        }
      );
      return () => unsubNotif();
    } catch (e) {
      console.warn('Failed to listen to developer notifications', e);
      setLoadingNotifications(false);
    }
  }, []);

  const unreadNotifications = useMemo(() => {
    return notifications.filter((n) => !n.read);
  }, [notifications]);

  const handleToggleNotificationRead = async (notifId: string, currentRead: boolean) => {
    try {
      const notifDocRef = doc(db, 'developer_notifications', notifId);
      await updateDoc(notifDocRef, {
        read: !currentRead,
        readAt: !currentRead ? serverTimestamp() : null,
      });
    } catch (err) {
      console.error('Error toggling notification status:', err);
    }
  };

  const handleMarkAllNotificationsAsRead = async () => {
    try {
      const unread = notifications.filter((n) => !n.read);
      if (unread.length === 0) return;
      const batch = writeBatch(db);
      unread.forEach((n) => {
        const notifDocRef = doc(db, 'developer_notifications', n.id);
        batch.update(notifDocRef, {
          read: true,
          readAt: serverTimestamp(),
        });
      });
      await batch.commit();
      onShowToast(`Marked ${unread.length} notification(s) as read`);
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
      onShowToast('Failed to mark notifications as read', true);
    }
  };

  const handleDeleteNotification = async (notifId: string) => {
    try {
      await deleteDoc(doc(db, 'developer_notifications', notifId));
      onShowToast('Notification removed');
    } catch (err) {
      console.error('Error deleting notification:', err);
      onShowToast('Failed to remove notification', true);
    }
  };

  const handleQuickAssignCode = (notif: DeveloperNotification) => {
    setShowNotificationDropdown(false);
    setActiveTab('users');
  };

  const handleExecuteDeveloperLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Sign out error:', err);
    } finally {
      localStorage.removeItem('counterpro_auth_v1');
      sessionStorage.clear();
      setIsLoggingOut(false);
      setShowLogoutConfirmModal(false);
      onLogout();
    }
  };

  // Helper to log developer actions to Firestore
  const logDeveloperAction = async (
    action: string,
    targetAgency: string,
    targetEmail: string,
    details: string,
    type?: string
  ) => {
    try {
      const payload = {
        type: type || 'IMPORTANT_ACTION',
        action,
        targetAgency,
        targetEmail,
        performedBy: currentUser.email || 'Developer',
        performedByRole: 'developer',
        details,
        timestamp: serverTimestamp(),
      };
      await addDoc(collection(db, 'developer_audit_logs'), payload);
      await addDoc(collection(db, 'activity_logs'), payload);
    } catch (err) {
      console.warn('Audit logging notice:', err);
    }
  };

  // 1. Real-time dynamic Firestore listener for all users
  useEffect(() => {
    const usersRef = collection(db, 'users');
    const unsub = onSnapshot(
      usersRef,
      (snap) => {
        const list: FirestoreUserData[] = [];
        snap.forEach((d) => {
          list.push({ id: d.id, ...d.data() } as FirestoreUserData);
        });
        setUsersList(list);
        setLoadingUsers(false);
      },
      (err) => {
        console.error('Error fetching users:', err);
        setLoadingUsers(false);
        onShowToast('Failed to load agencies list from database', true);
      }
    );
    return () => unsub();
  }, [onShowToast]);

  // 2. Real-time dynamic Firestore listener for Agency Licenses collection
  useEffect(() => {
    const licensesRef = collection(db, 'agency_licenses');
    const unsub = onSnapshot(
      licensesRef,
      (snap) => {
        const list: AgencyLicense[] = [];
        snap.forEach((d) => {
          list.push({ id: d.id, ...d.data() } as AgencyLicense);
        });
        // Sort active first, then created desc
        list.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
        setLicenses(list);
        setLoadingLicenses(false);
      },
      (err) => {
        console.warn('Licenses listener notice:', err);
        setLoadingLicenses(false);
      }
    );
    return () => unsub();
  }, []);

  // 3. Real-time dynamic Firestore listener for Activity Logs & Developer Audit Logs
  const [activityLogsList, setActivityLogsList] = useState<AuditLog[]>([]);
  const [developerAuditList, setDeveloperAuditList] = useState<AuditLog[]>([]);

  useEffect(() => {
    try {
      const actRef = collection(db, 'activity_logs');
      const qAct = query(actRef, orderBy('timestamp', 'desc'), limit(150));
      const unsubAct = onSnapshot(
        qAct,
        (snap) => {
          const list: AuditLog[] = [];
          snap.forEach((d) => {
            list.push({ id: d.id, ...d.data() } as AuditLog);
          });
          setActivityLogsList(list);
          setLoadingLogs(false);
        },
        (err) => {
          console.warn('activity_logs listener notice:', err);
          setLoadingLogs(false);
        }
      );

      const auditRef = collection(db, 'developer_audit_logs');
      const qAudit = query(auditRef, orderBy('timestamp', 'desc'), limit(150));
      const unsubAudit = onSnapshot(
        qAudit,
        (snap) => {
          const list: AuditLog[] = [];
          snap.forEach((d) => {
            list.push({ id: d.id, ...d.data() } as AuditLog);
          });
          setDeveloperAuditList(list);
          setLoadingLogs(false);
        },
        (err) => {
          console.warn('developer_audit_logs listener notice:', err);
          setLoadingLogs(false);
        }
      );

      return () => {
        unsubAct();
        unsubAudit();
      };
    } catch (e) {
      console.warn('Failed to initialize logs listeners', e);
      setLoadingLogs(false);
    }
  }, []);

  // Merge and sort logs latest activity first
  useEffect(() => {
    const combined = [...activityLogsList, ...developerAuditList];
    const seen = new Set<string>();
    const unique = combined.filter((item) => {
      if (!item.id || seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });

    unique.sort((a, b) => {
      const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : (a.timestamp ? new Date(a.timestamp).getTime() : 0);
      const timeB = b.timestamp?.toMillis ? b.timestamp.toMillis() : (b.timestamp ? new Date(b.timestamp).getTime() : 0);
      return timeB - timeA;
    });

    setAuditLogs(unique);
  }, [activityLogsList, developerAuditList]);

  // 4. Real-time dynamic listener for Developer System Configuration
  useEffect(() => {
    const configDocRef = doc(db, 'settings', 'developer_system_config');
    const unsubConfig = onSnapshot(
      configDocRef,
      (snap) => {
        if (snap.exists()) {
          setSystemConfig({ ...DEFAULT_CONFIG, ...snap.data() } as SystemConfig);
        } else {
          setSystemConfig(DEFAULT_CONFIG);
        }
        setLoadingConfig(false);
      },
      (err) => {
        console.warn('Developer config read notice:', err);
        setLoadingConfig(false);
      }
    );
    return () => unsubConfig();
  }, []);

  // Format timestamp helper
  const formatTimestamp = (ts: any): string => {
    if (!ts) return 'N/A';
    try {
      const date = ts.toDate ? ts.toDate() : new Date(ts);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'N/A';
    }
  };

  // Helper to determine boolean active status
  const isUserActive = (u: FirestoreUserData): boolean => {
    if (u.management?.accountStatus === true) return true;
    if (u.management?.accountStatus === false) return false;
    if (u.accountStatus === true) return true;
    if (u.accountStatus === false) return false;
    if (u.status === 'Active' || u.status === 'approved') return true;
    if (u.status === 'Suspended' || u.status === 'DEACTIVE' || u.status === 'blocked') return false;
    return u.isApproved === true;
  };

  const isUserSuspended = (u: FirestoreUserData): boolean => {
    if (u.management?.accountStatus === false) return true;
    if (u.accountStatus === false) return true;
    if (u.status === 'Suspended' || u.status === 'DEACTIVE' || u.status === 'blocked') return true;
    return false;
  };

  // Derived Counts for Dashboard
  const totalCount = usersList.length;
  const activeCount = useMemo(() => usersList.filter((u) => isUserActive(u)).length, [usersList]);
  const suspendedCount = useMemo(() => usersList.filter((u) => isUserSuspended(u)).length, [usersList]);
  const pendingCount = useMemo(() => usersList.filter((u) => !isUserActive(u) && !isUserSuspended(u)).length, [usersList]);
  const withCodeCount = useMemo(() => usersList.filter((u) => (u.management?.agencyCode || u.agencyCode || '').trim() !== '').length, [usersList]);

  // Generate Unique License Code
  const generateUniqueCode = (prefix = systemConfig.defaultCodePrefix || 'ZH-SNT-') => {
    const existingCodes = new Set([
      ...usersList.map((u) => (u.management?.agencyCode || u.agencyCode || '').toUpperCase().trim()),
      ...licenses.map((l) => (l.code || '').toUpperCase().trim()),
    ]);
    let randomNum = Math.floor(1000 + Math.random() * 9000);
    let candidate = `${prefix}${randomNum}`;
    while (existingCodes.has(candidate.toUpperCase())) {
      randomNum = Math.floor(1000 + Math.random() * 9000);
      candidate = `${prefix}${randomNum}`;
    }
    return candidate;
  };

  // --- USER MANAGEMENT HANDLERS ---
  const handleStatusChange = async (userId: string, newStatusBool: boolean | 'Pending') => {
    setUpdatingId(userId);
    try {
      const userRef = doc(db, 'users', userId);
      const targetUser = usersList.find((u) => u.id === userId);
      const targetAgencyName = targetUser?.information?.agencyName || targetUser?.agencyName || 'Agency';
      const targetEmail = targetUser?.information?.email || targetUser?.email || '';

      const updatePayload: Record<string, any> = {};

      if (newStatusBool === true) {
        updatePayload['accountStatus'] = true;
        updatePayload['management.accountStatus'] = true;
        updatePayload['status'] = 'Active';
        updatePayload['isApproved'] = true;
        updatePayload['management.activatedAt'] = serverTimestamp();
      } else if (newStatusBool === false) {
        updatePayload['accountStatus'] = false;
        updatePayload['management.accountStatus'] = false;
        updatePayload['status'] = 'Suspended';
        updatePayload['isApproved'] = false;
      } else {
        updatePayload['accountStatus'] = null;
        updatePayload['management.accountStatus'] = 'Pending';
        updatePayload['status'] = 'Pending';
        updatePayload['isApproved'] = false;
      }

      await updateDoc(userRef, updatePayload);

      await logDeveloperAction(
        newStatusBool === true ? 'ACTIVATE_ACCOUNT' : newStatusBool === false ? 'DEACTIVATE_ACCOUNT' : 'SET_PENDING',
        targetAgencyName,
        targetEmail,
        `Account status changed to: ${newStatusBool === true ? 'Active (true)' : newStatusBool === false ? 'Suspended (false)' : 'Pending'}`
      );

      onShowToast(
        newStatusBool === true
          ? 'User activated successfully (accountStatus: true)'
          : newStatusBool === false
          ? 'User deactivated / suspended (accountStatus: false)'
          : 'User status set to Pending'
      );
    } catch (err) {
      console.error('Error updating status:', err);
      onShowToast('Failed to update status in Firestore', true);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleActivateAllUsers = async () => {
    if (usersList.length === 0) return;
    setIsActivatingAll(true);
    try {
      const batch = writeBatch(db);
      usersList.forEach((u) => {
        const userRef = doc(db, 'users', u.id);
        batch.update(userRef, {
          accountStatus: true,
          'management.accountStatus': true,
          status: 'Active',
          isApproved: true,
          'management.activatedAt': serverTimestamp(),
        });
      });

      await batch.commit();

      await logDeveloperAction(
        'BATCH_ACTIVATE_ALL',
        'All Registered Agencies',
        'System Action',
        `Batch activated ${usersList.length} accounts with accountStatus: true`
      );

      onShowToast(`Successfully activated ${usersList.length} agencies (accountStatus: true)`);
    } catch (err) {
      console.error('Error activating all users:', err);
      onShowToast('Failed to batch activate users', true);
    } finally {
      setIsActivatingAll(false);
    }
  };

  const handleSaveAgencyCodeToUser = async (userId: string, customCode?: string) => {
    if (customCode === undefined) return;
    setUpdatingId(userId);
    try {
      const codeTrimmed = customCode.trim();
      const userRef = doc(db, 'users', userId);
      const targetUser = usersList.find((u) => u.id === userId);
      const targetAgencyName = targetUser?.information?.agencyName || targetUser?.agencyName || 'Agency';
      const targetEmail = targetUser?.information?.email || targetUser?.email || '';
      const oldCode = targetUser?.management?.agencyCode || targetUser?.agencyCode || targetUser?.loginId || '(none)';

      // Check uniqueness: Agency Codes must be unique across all users
      if (codeTrimmed) {
        const duplicate = usersList.find(
          (u) =>
            u.id !== userId &&
            (u.management?.agencyCode || u.agencyCode || u.loginId || '').trim().toUpperCase() === codeTrimmed.toUpperCase()
        );
        if (duplicate) {
          const dupName = duplicate.information?.agencyName || duplicate.agencyName || 'another agency';
          onShowToast(`Agency Code "${codeTrimmed}" is already assigned to "${dupName}". Codes must be unique.`, true);
          return;
        }
      }

      // Save new Agency Code to Firebase immediately
      // Update all identifier fields so this new code becomes the active login identifier
      await updateDoc(userRef, {
        agencyCode: codeTrimmed,
        'management.agencyCode': codeTrimmed,
        loginId: codeTrimmed,
        memberId: codeTrimmed,
      });

      // Update matching registration notifications for this user
      const matchingNotifs = notifications.filter((n) => n.userId === userId);
      for (const notif of matchingNotifs) {
        try {
          await updateDoc(doc(db, 'developer_notifications', notif.id), {
            agencyCodeAssigned: !!codeTrimmed,
            agencyCode: codeTrimmed,
          });
        } catch (e) {
          console.warn('Notice updating notification agencyCode:', e);
        }
      }

      // Sync with Agency Licenses pool if active
      if (codeTrimmed) {
        const matchingLicense = licenses.find((l) => l.code.toUpperCase() === codeTrimmed.toUpperCase());
        if (matchingLicense) {
          try {
            await updateDoc(doc(db, 'agency_licenses', matchingLicense.id), {
              status: 'active',
              assignedUserId: userId,
              assignedAgencyName: targetAgencyName,
              assignedEmail: targetEmail,
              assignedAt: serverTimestamp(),
            });
          } catch (licErr) {
            console.warn('Notice updating license pool:', licErr);
          }
        }
      }

      await logDeveloperAction(
        'AGENCY_CODE_CHANGE',
        targetAgencyName,
        targetEmail,
        `Agency Code updated from "${oldCode}" to "${codeTrimmed || '(revoked)'}" by Developer`,
        'AGENCY_CODE_CHANGE'
      );

      // Record in activity_logs
      try {
        await addDoc(collection(db, 'activity_logs'), {
          type: 'AGENCY_CODE_CHANGE',
          action: 'AGENCY_CODE_CHANGE',
          targetAgency: targetAgencyName,
          targetEmail: targetEmail,
          targetUserId: userId,
          performedBy: currentUser.email || 'Developer',
          performedByRole: 'developer',
          details: `Developer updated Agency Code for "${targetAgencyName}" to "${codeTrimmed || '(revoked)'}"`,
          timestamp: serverTimestamp(),
        });
      } catch (err) {
        console.warn('Activity log notice:', err);
      }

      onShowToast(`Agency Code successfully updated to "${codeTrimmed || '(revoked)'}" for ${targetAgencyName}`);
    } catch (err) {
      console.error('Error saving agency code:', err);
      onShowToast('Failed to save agency code to database', true);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleSavePermittedUserInfo = async (
    userId: string,
    updatedInfo: { agencyName: string; adminName: string; agencyLocation: string; email: string }
  ) => {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        agencyName: updatedInfo.agencyName,
        adminName: updatedInfo.adminName,
        agencyLocation: updatedInfo.agencyLocation,
        email: updatedInfo.email,
        'information.agencyName': updatedInfo.agencyName,
        'information.adminName': updatedInfo.adminName,
        'information.agencyLocation': updatedInfo.agencyLocation,
        'information.email': updatedInfo.email,
        'management.userName': updatedInfo.adminName,
      });

      await logDeveloperAction(
        'EDIT_USER_INFO',
        updatedInfo.agencyName,
        updatedInfo.email,
        `Updated user info for UID: ${userId}`
      );

      onShowToast('User information saved to Firebase successfully');
    } catch (err) {
      console.error('Error updating user info:', err);
      onShowToast('Failed to update user info in Firestore', true);
    }
  };

  const handleSendPasswordReset = async (u: FirestoreUserData) => {
    const email = u.information?.email || u.email;
    if (!email) {
      onShowToast('User does not have a registered email address', true);
      return;
    }

    setSendingResetId(u.id);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      const targetAgencyName = u.information?.agencyName || u.agencyName || 'Agency';
      await logDeveloperAction(
        'PASSWORD_RESET_TRIGGERED',
        targetAgencyName,
        email,
        `Triggered Firebase Auth password reset email to ${email}`
      );
      onShowToast(`Password reset link sent to ${email}`);
    } catch (err: any) {
      console.error('Password reset trigger error:', err);
      onShowToast(err?.message || 'Failed to send password reset email', true);
    } finally {
      setSendingResetId(null);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    if (deleteConfirmText.trim().toLowerCase() !== 'delete') {
      onShowToast('Please type "DELETE" to confirm account deletion', true);
      return;
    }

    setIsDeleting(true);
    try {
      const targetAgencyName = userToDelete.information?.agencyName || userToDelete.agencyName || 'Agency';
      const targetEmail = userToDelete.information?.email || userToDelete.email || '';

      await deleteDoc(doc(db, 'users', userToDelete.id));

      await logDeveloperAction(
        'DELETE_USER',
        targetAgencyName,
        targetEmail,
        `Deleted user document UID: ${userToDelete.id} from Firestore`
      );

      onShowToast(`Agency account "${targetAgencyName}" deleted successfully`);
      setUserToDelete(null);
      setDeleteConfirmText('');
    } catch (err) {
      console.error('Error deleting user:', err);
      onShowToast('Failed to delete user document', true);
    } finally {
      setIsDeleting(false);
    }
  };

  // --- AGENCY LICENSE / CODE MANAGEMENT HANDLERS ---
  const handleCreateLicense = async (code: string, status: 'active' | 'deactive', notes?: string) => {
    try {
      const docRef = await addDoc(collection(db, 'agency_licenses'), {
        code: code.toUpperCase().trim(),
        status,
        notes: notes || '',
        assignedUserId: null,
        assignedAgencyName: null,
        assignedEmail: null,
        createdAt: serverTimestamp(),
      });

      await logDeveloperAction(
        'CREATE_AGENCY_CODE',
        'License Pool',
        'System',
        `Created new Agency Code: ${code} (Status: ${status})`
      );

      onShowToast(`Agency Code "${code}" created in Firebase`);
    } catch (err) {
      console.error('Error creating license:', err);
      onShowToast('Failed to create agency code in Firestore', true);
    }
  };

  const handleUpdateLicense = async (licenseId: string, updates: Partial<AgencyLicense>) => {
    try {
      const licRef = doc(db, 'agency_licenses', licenseId);
      await updateDoc(licRef, updates);

      await logDeveloperAction(
        'EDIT_AGENCY_CODE',
        updates.assignedAgencyName || 'License Pool',
        updates.assignedEmail || 'System',
        `Updated Agency Code ID: ${licenseId}`
      );

      onShowToast('Agency Code updated in Firebase');
    } catch (err) {
      console.error('Error updating license:', err);
      onShowToast('Failed to update agency code', true);
    }
  };

  const handleDeleteLicense = async (licenseId: string, code: string) => {
    try {
      await deleteDoc(doc(db, 'agency_licenses', licenseId));

      await logDeveloperAction(
        'DELETE_AGENCY_CODE',
        'License Pool',
        'System',
        `Deleted Agency Code: ${code}`
      );

      onShowToast(`Agency Code "${code}" deleted from Firebase`);
    } catch (err) {
      console.error('Error deleting license:', err);
      onShowToast('Failed to delete agency code', true);
    }
  };

  const handleAssignLicenseToUser = async (licenseId: string, code: string, userId: string) => {
    try {
      const targetUser = usersList.find((u) => u.id === userId);
      const agencyName = targetUser?.information?.agencyName || targetUser?.agencyName || 'Agency';
      const email = targetUser?.information?.email || targetUser?.email || '';

      // Update license document
      const licRef = doc(db, 'agency_licenses', licenseId);
      await updateDoc(licRef, {
        assignedUserId: userId,
        assignedAgencyName: agencyName,
        assignedEmail: email,
        assignedAt: serverTimestamp(),
      });

      // Update user document
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        agencyCode: code,
        'management.agencyCode': code,
      });

      await logDeveloperAction(
        'ASSIGN_AGENCY_CODE',
        agencyName,
        email,
        `Assigned Agency Code ${code} to user UID: ${userId}`
      );

      onShowToast(`Agency Code "${code}" assigned to ${agencyName}`);
    } catch (err) {
      console.error('Error assigning license:', err);
      onShowToast('Failed to assign agency code', true);
    }
  };

  const handleUnassignLicense = async (licenseId: string, code: string) => {
    try {
      const lic = licenses.find((l) => l.id === licenseId);
      const prevUserId = lic?.assignedUserId;

      const licRef = doc(db, 'agency_licenses', licenseId);
      await updateDoc(licRef, {
        assignedUserId: null,
        assignedAgencyName: null,
        assignedEmail: null,
        assignedAt: null,
      });

      if (prevUserId) {
        const userRef = doc(db, 'users', prevUserId);
        await updateDoc(userRef, {
          agencyCode: '',
          'management.agencyCode': '',
        });
      }

      await logDeveloperAction(
        'UNASSIGN_AGENCY_CODE',
        lic?.assignedAgencyName || 'Agency',
        lic?.assignedEmail || '',
        `Unassigned Agency Code ${code}`
      );

      onShowToast(`Agency Code "${code}" unassigned and returned to pool`);
    } catch (err) {
      console.error('Error unassigning license:', err);
      onShowToast('Failed to unassign agency code', true);
    }
  };

  const handleToggleLicenseStatus = async (licenseId: string, code: string, currentStatus: 'active' | 'deactive') => {
    const nextStatus = currentStatus === 'active' ? 'deactive' : 'active';
    try {
      const licRef = doc(db, 'agency_licenses', licenseId);
      await updateDoc(licRef, {
        status: nextStatus,
      });

      await logDeveloperAction(
        nextStatus === 'active' ? 'ACTIVATE_AGENCY_CODE' : 'DEACTIVATE_AGENCY_CODE',
        'License Pool',
        'System',
        `Changed status of Agency Code ${code} to ${nextStatus}`
      );

      onShowToast(`Agency Code "${code}" set to ${nextStatus}`);
    } catch (err) {
      console.error('Error toggling license status:', err);
      onShowToast('Failed to update agency code status', true);
    }
  };

  // --- SYSTEM CONFIG & DATABASE UTILITIES ---
  const handleSaveSystemConfig = async (updated: SystemConfig) => {
    setConfigSaving(true);
    try {
      const configDocRef = doc(db, 'settings', 'developer_system_config');
      const payload = {
        ...updated,
        updatedAt: serverTimestamp(),
        updatedBy: currentUser.email || 'Developer',
      };
      await setDoc(configDocRef, payload, { merge: true });

      // If current user is the developer, also update their user document
      if (currentUser.uid) {
        const userRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userRef, {
          email: updated.developerEmail,
          agencyCode: updated.developerCode,
          'management.agencyCode': updated.developerCode,
        }).catch(() => {});
      }

      await logDeveloperAction(
        'CONFIG_UPDATE',
        'Developer Configuration',
        updated.developerEmail,
        `Updated Developer Email to ${updated.developerEmail}, Developer Code to ${updated.developerCode}, Maintenance=${updated.maintenanceMode}`
      );

      // Record in activity_logs
      try {
        await addDoc(collection(db, 'activity_logs'), {
          type: 'DEVELOPER_CONFIG_CHANGE',
          action: 'DEVELOPER_CONFIG_CHANGE',
          targetAgency: 'System Settings',
          targetEmail: updated.developerEmail,
          performedBy: currentUser.email || 'Developer',
          performedByRole: 'developer',
          details: `Developer updated credentials & system policies in Firebase. (Email: ${updated.developerEmail}, Code: ${updated.developerCode})`,
          timestamp: serverTimestamp(),
        });
      } catch (err) {
        console.warn('Activity log notice:', err);
      }

      onShowToast('Developer Configuration saved successfully to Firebase');
    } catch (err) {
      console.error('Error saving system config:', err);
      onShowToast('Failed to save developer configuration', true);
      throw err;
    } finally {
      setConfigSaving(false);
    }
  };

  const handlePingDatabase = async () => {
    setIsPinging(true);
    const start = performance.now();
    try {
      await getDocFromServer(doc(db, 'settings', 'developer_system_config'));
      const duration = Math.round(performance.now() - start);
      setPingLatency(duration);
      onShowToast(`Firestore connection active. Ping latency: ${duration}ms`);
    } catch (err: any) {
      const duration = Math.round(performance.now() - start);
      setPingLatency(duration);
      onShowToast(`Firestore responded in ${duration}ms`);
    } finally {
      setIsPinging(false);
    }
  };

  const handleExportDataJSON = () => {
    try {
      const exportObject = {
        exportedAt: new Date().toISOString(),
        exportedBy: currentUser.email,
        totalAgencies: usersList.length,
        totalLicenses: licenses.length,
        systemConfig,
        agencies: usersList,
        licenses: licenses,
        auditLogs: auditLogs.slice(0, 100),
      };

      const blob = new Blob([JSON.stringify(exportObject, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `developer_database_backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      onShowToast('Database export downloaded successfully');
    } catch (err) {
      console.error('Export error:', err);
      onShowToast('Failed to export JSON backup', true);
    }
  };

  // Filtered Audit Logs
  const filteredLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      const q = logSearch.toLowerCase();
      const matchesSearch =
        (log.action || '').toLowerCase().includes(q) ||
        (log.targetAgency || '').toLowerCase().includes(q) ||
        (log.targetEmail || '').toLowerCase().includes(q) ||
        (log.details || '').toLowerCase().includes(q);

      let matchesAction = true;
      if (logFilterAction !== 'all') {
        matchesAction = log.action === logFilterAction;
      }
      return matchesSearch && matchesAction;
    });
  }, [auditLogs, logSearch, logFilterAction]);

  return (
    <div className="min-h-screen bg-[#070A0E] text-[#E9EEF3] flex flex-col font-sans selection:bg-amber-500/30">
      {/* Topbar: Developer Master Control */}
      <header className="sticky top-0 z-40 bg-[#0E131A]/95 backdrop-blur-md border-b border-[#1E2633] px-4 sm:px-6 py-3 flex items-center justify-between shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white border border-white/30 flex items-center justify-center shadow-lg shadow-black/30 p-1 overflow-hidden flex-shrink-0">
            <img
              src={systemConfig.appLogo || ZH_OFFICIAL_LOGO}
              alt="System Logo"
              className="w-full h-full object-contain filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.15)]"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = ZH_OFFICIAL_LOGO;
              }}
              referrerPolicy="no-referrer"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-extrabold tracking-wider text-white font-display uppercase drop-shadow-sm">
                DEVELOPER CONTROL PANEL
              </h1>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                Master Root
              </span>
            </div>
            <p className="text-xs text-white/80">
              Enterprise System Authorization &amp; Infrastructure Governance
            </p>
          </div>
        </div>

        {/* Developer Session Info, Notification Bell & Sign Out */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Real-time Notification Bell Popover Trigger */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowNotificationDropdown((prev) => !prev)}
              className={`relative p-2 rounded-xl border transition-all cursor-pointer ${
                unreadNotifications.length > 0
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-400 hover:bg-amber-500/25 shadow-sm'
                  : 'bg-[#141A23] border-[#232D3B] text-white/80 hover:text-white hover:bg-[#1A222F]'
              }`}
              title="Real-time User Registration & System Notifications"
            >
              <Bell size={18} />
              {unreadNotifications.length > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white font-mono text-[10px] font-bold flex items-center justify-center px-1 shadow-md shadow-red-500/50 animate-pulse">
                  {unreadNotifications.length}
                </span>
              )}
            </button>

            {/* Notifications Popover Dropdown */}
            <AnimatePresence>
              {showNotificationDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 mt-2 w-80 sm:w-96 bg-[#0E141C] border border-[#232D3B] rounded-2xl shadow-2xl z-50 overflow-hidden text-xs"
                >
                  <div className="p-3.5 bg-[#141A23] border-b border-[#1E2633] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bell size={16} className="text-amber-400" />
                      <span className="font-bold text-white">Registration Notifications</span>
                      {unreadNotifications.length > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                          {unreadNotifications.length} new
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {unreadNotifications.length > 0 && (
                        <button
                          type="button"
                          onClick={handleMarkAllNotificationsAsRead}
                          className="text-[11px] text-amber-400 hover:text-amber-300 font-semibold cursor-pointer hover:underline"
                        >
                          Mark all read
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setShowNotificationDropdown(false)}
                        className="text-white/70 hover:text-white p-1"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="max-h-[380px] overflow-y-auto divide-y divide-[#1E2633] p-1 space-y-1">
                    {loadingNotifications ? (
                      <div className="py-8 text-center text-white/70">
                        <div className="w-5 h-5 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin mx-auto mb-2" />
                        Loading notifications...
                      </div>
                    ) : notifications.length === 0 ? (
                      <div className="py-10 text-center text-white/70 space-y-1.5 px-4">
                        <Inbox size={28} className="mx-auto opacity-30 text-amber-400" />
                        <p className="font-semibold text-white">No Notifications</p>
                        <p className="text-[11px] text-white/70">When a new user verifies their registration, you will receive real-time alerts here.</p>
                      </div>
                    ) : (
                      notifications.map((notif) => {
                        const targetUser = usersList.find((u) => u.id === notif.userId);
                        const liveAgencyCode =
                          targetUser?.management?.agencyCode || targetUser?.agencyCode || notif.agencyCode || '';
                        const hasCode = Boolean(liveAgencyCode.trim());

                        return (
                          <div
                            key={notif.id}
                            className={`p-3 rounded-xl transition-all space-y-2 ${
                              notif.read ? 'bg-[#0E141C] opacity-75' : 'bg-[#141A23] border border-amber-500/20'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="space-y-0.5 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-white truncate">
                                    {notif.agencyName || 'New Agency'}
                                  </span>
                                  {!notif.read && (
                                    <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                                  )}
                                </div>
                                <p className="text-[11px] text-white/70">
                                  Admin: <strong className="text-white">{notif.adminName || 'Admin'}</strong> •{' '}
                                  <span className="font-mono text-white/90">{notif.email}</span>
                                </p>
                              </div>

                              <div className="flex items-center gap-1 flex-shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleToggleNotificationRead(notif.id, notif.read)}
                                  className="p-1 text-white/70 hover:text-emerald-400 cursor-pointer"
                                  title={notif.read ? 'Mark unread' : 'Mark read'}
                                >
                                  <Check size={14} className={notif.read ? 'text-emerald-400' : ''} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteNotification(notif.id)}
                                  className="p-1 text-white/70 hover:text-red-400 cursor-pointer"
                                  title="Delete notification"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>

                            {/* Code Status Badge & Quick Action */}
                            <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#1E2633]/60 text-[11px]">
                              <div>
                                {hasCode ? (
                                  <span className="text-emerald-400 font-mono font-bold flex items-center gap-1">
                                    <CheckCircle2 size={12} />
                                    <span>Code: {liveAgencyCode}</span>
                                  </span>
                                ) : (
                                  <span className="text-amber-400 font-semibold flex items-center gap-1">
                                    <AlertTriangle size={12} />
                                    <span>No Agency Code Assigned</span>
                                  </span>
                                )}
                              </div>

                              <button
                                type="button"
                                onClick={() => handleQuickAssignCode(notif)}
                                className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                              >
                                <Key size={11} />
                                <span>{hasCode ? 'Manage Code' : 'Assign Code'}</span>
                              </button>
                            </div>

                            <div className="text-[10px] text-white/60 font-mono">
                              {formatTimestamp(notif.registeredAt || notif.createdAt)}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="hidden md:flex items-center gap-2 text-xs font-mono bg-[#141A23] border border-[#232D3B] px-3 py-1.5 rounded-xl text-white/80">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-white font-medium">{currentUser.email}</span>
          </div>

          <button
            type="button"
            onClick={() => setShowLogoutConfirmModal(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 transition-all cursor-pointer shadow-sm"
          >
            <LogOut size={15} />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Developer Container */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Navigation Tabs Bar */}
        <div className="flex items-center justify-between border-b border-[#1E2633] pb-3 gap-2 overflow-x-auto">
          <div className="flex items-center gap-1.5 sm:gap-2">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: Shield, count: null },
              { id: 'users', label: 'User Management', icon: Users, count: totalCount },
              { id: 'userData', label: 'User Data Explorer', icon: Database, count: null },
              { id: 'licenses', label: 'Agency Codes / Licenses', icon: Key, count: licenses.length },
              { id: 'activity', label: 'Activity Logs', icon: Activity, count: auditLogs.length },
              { id: 'config', label: 'Configuration', icon: Sliders, count: null },
              { id: 'database', label: 'Firebase Data Management', icon: Database, count: null },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                      : 'bg-[#121822] text-white/80 border border-[#202A38] hover:text-white hover:bg-[#161E2B]'
                  }`}
                >
                  <Icon size={15} />
                  <span>{tab.label}</span>
                  {tab.count !== null && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-md font-mono ${
                        isActive ? 'bg-black/25 text-white' : 'bg-[#1C2634] text-white/90 font-bold'
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* TAB 1: DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* New User Registrations Pending Action Alert Banner */}
            {unreadNotifications.length > 0 && (
              <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-amber-600/10 to-orange-600/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg shadow-amber-500/5">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400">
                    <Bell size={20} className="animate-bounce" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <span>New Agency Registrations Pending Review</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white">
                        {unreadNotifications.length} New
                      </span>
                    </h4>
                    <p className="text-xs text-white/80 mt-0.5">
                      New agency accounts have been registered and verified. Assign active Agency Codes so they can log in.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('users')}
                    className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer whitespace-nowrap"
                  >
                    <Key size={13} />
                    <span>Assign Agency Codes</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowNotificationDropdown(true)}
                    className="px-3.5 py-2 rounded-xl bg-[#141A23] hover:bg-[#1A222F] text-white border border-[#232D3B] text-xs font-semibold transition-all cursor-pointer whitespace-nowrap"
                  >
                    View Alerts
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-[#0E141C] border border-[#1E2633] rounded-2xl p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/80 font-medium">Registered Agencies</span>
                  <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                    <Building2 size={18} />
                  </div>
                </div>
                <div className="text-3xl font-extrabold text-white mt-2 font-mono">{totalCount}</div>
                <div className="text-[11px] text-white/70 mt-1 flex items-center gap-1">
                  <span>Firestore Sync:</span>
                  <span className="text-emerald-400 font-mono font-semibold">Active</span>
                </div>
              </div>

              <div className="bg-[#0E141C] border border-emerald-500/20 bg-emerald-500/5 rounded-2xl p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-emerald-400 font-medium">Active Accounts (true)</span>
                  <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400">
                    <UserCheck size={18} />
                  </div>
                </div>
                <div className="text-3xl font-extrabold text-emerald-400 mt-2 font-mono">{activeCount}</div>
                <div className="text-[11px] text-white/70 mt-1">
                  {totalCount > 0 ? `${Math.round((activeCount / totalCount) * 100)}% of total` : '0%'}
                </div>
              </div>

              <div className="bg-[#0E141C] border border-red-500/20 bg-red-500/5 rounded-2xl p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-red-400 font-medium">Suspended / Deactive</span>
                  <div className="p-2 rounded-xl bg-red-500/15 text-red-400">
                    <UserX size={18} />
                  </div>
                </div>
                <div className="text-3xl font-extrabold text-red-400 mt-2 font-mono">{suspendedCount}</div>
                <div className="text-[11px] text-white/70 mt-1">Blocked in Firestore</div>
              </div>

              <div className="bg-[#0E141C] border border-amber-500/20 bg-amber-500/5 rounded-2xl p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-amber-400 font-medium">Agency Codes in Pool</span>
                  <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400">
                    <Key size={18} />
                  </div>
                </div>
                <div className="text-3xl font-extrabold text-amber-400 mt-2 font-mono">{licenses.length}</div>
                <div className="text-[11px] text-white/70 mt-1">
                  {licenses.filter((l) => Boolean(l.assignedUserId)).length} assigned / {licenses.filter((l) => !l.assignedUserId).length} free
                </div>
              </div>
            </div>

            {/* Quick Actions & Live Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-[#0E141C] border border-[#1E2633] rounded-2xl p-5 space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Zap size={17} className="text-amber-400" />
                  <span>Developer Quick Controls</span>
                </h3>
                <div className="space-y-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('users')}
                    className="w-full p-3 rounded-xl bg-[#141A23] hover:bg-[#1A222F] border border-[#232D3B] text-xs font-semibold text-white flex items-center justify-between transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <Users size={16} className="text-amber-400" />
                      <span>User Management &amp; Permissions</span>
                    </div>
                    <ChevronRight size={15} className="text-white/60" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('userData')}
                    className="w-full p-3 rounded-xl bg-[#141A23] hover:bg-[#1A222F] border border-[#232D3B] text-xs font-semibold text-white flex items-center justify-between transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <Database size={16} className="text-amber-400" />
                      <span>Explore User Trips &amp; Bookings Data</span>
                    </div>
                    <ChevronRight size={15} className="text-white/60" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('licenses')}
                    className="w-full p-3 rounded-xl bg-[#141A23] hover:bg-[#1A222F] border border-[#232D3B] text-xs font-semibold text-white flex items-center justify-between transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <Key size={16} className="text-emerald-400" />
                      <span>Manage Agency Codes &amp; Licenses</span>
                    </div>
                    <ChevronRight size={15} className="text-white/60" />
                  </button>

                  <button
                    type="button"
                    onClick={handlePingDatabase}
                    disabled={isPinging}
                    className="w-full p-3 rounded-xl bg-[#141A23] hover:bg-[#1A222F] border border-[#232D3B] text-xs font-semibold text-white flex items-center justify-between transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <Radio size={16} className="text-blue-400" />
                      <span>Test Firestore Live Latency</span>
                    </div>
                    <span className="text-[11px] font-mono text-blue-400">
                      {isPinging ? 'Pinging...' : pingLatency ? `${pingLatency}ms` : 'Ping Now'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={handleExportDataJSON}
                    className="w-full p-3 rounded-xl bg-[#141A23] hover:bg-[#1A222F] border border-[#232D3B] text-xs font-semibold text-white flex items-center justify-between transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <Download size={16} className="text-purple-400" />
                      <span>Export Database JSON Snapshot</span>
                    </div>
                    <FileJson size={15} className="text-white/60" />
                  </button>
                </div>
              </div>

              {/* Recent Audit Feed */}
              <div className="lg:col-span-2 bg-[#0E141C] border border-[#1E2633] rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Activity size={17} className="text-amber-400" />
                    <span>Real-time System Audit Stream</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => setActiveTab('activity')}
                    className="text-xs text-amber-400 hover:underline cursor-pointer font-semibold"
                  >
                    View All ({auditLogs.length})
                  </button>
                </div>

                {loadingLogs ? (
                  <div className="py-12 text-center text-xs text-white/70">
                    <div className="w-6 h-6 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin mx-auto mb-2" />
                    Loading audit stream...
                  </div>
                ) : auditLogs.length === 0 ? (
                  <div className="py-12 text-center text-xs text-white/70">
                    No activity logged yet. System operations will appear here automatically.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                    {auditLogs.slice(0, 6).map((log) => (
                      <div
                        key={log.id}
                        className="p-3 rounded-xl bg-[#141A23] border border-[#232D3B] text-xs flex items-center justify-between gap-3"
                      >
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30">
                              {log.action}
                            </span>
                            <strong className="text-white truncate">{log.targetAgency}</strong>
                          </div>
                          <p className="text-white/80 text-[11px] truncate">{log.details}</p>
                        </div>
                        <div className="text-[10px] text-white/60 font-mono whitespace-nowrap">
                          {formatTimestamp(log.timestamp)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: USER MANAGEMENT */}
        {activeTab === 'users' && (
          <UserManagerSection
            usersList={usersList}
            loadingUsers={loadingUsers}
            updatingId={updatingId}
            sendingResetId={sendingResetId}
            isActivatingAll={isActivatingAll}
            onStatusChange={handleStatusChange}
            onActivateAll={handleActivateAllUsers}
            onSaveAgencyCode={handleSaveAgencyCodeToUser}
            onSendPasswordReset={handleSendPasswordReset}
            onDeleteClick={(u) => setUserToDelete(u)}
            onSaveUserInfo={handleSavePermittedUserInfo}
            formatTimestamp={formatTimestamp}
            isUserActive={isUserActive}
            isUserSuspended={isUserSuspended}
            onInspectUserData={(u) => {
              setExplorerSelectedUserId(u.id);
              setActiveTab('userData');
              onShowToast(`Inspecting data for ${u.information?.agencyName || u.agencyName || 'Agency'}`);
            }}
          />
        )}

        {/* TAB 2.5: USER DATA EXPLORER & DEEP AUDITOR */}
        {activeTab === 'userData' && (
          <UserDataExplorerSection
            usersList={usersList}
            loadingUsers={loadingUsers}
            selectedUserId={explorerSelectedUserId}
            onSelectUser={(uid) => setExplorerSelectedUserId(uid)}
            formatTimestamp={formatTimestamp}
            isUserActive={isUserActive}
            isUserSuspended={isUserSuspended}
          />
        )}

        {/* TAB 3: AGENCY CODES / LICENSES */}
        {activeTab === 'licenses' && (
          <AgencyLicenseSection
            licenses={licenses}
            usersList={usersList}
            loadingLicenses={loadingLicenses}
            onCreateLicense={handleCreateLicense}
            onUpdateLicense={handleUpdateLicense}
            onDeleteLicense={handleDeleteLicense}
            onAssignLicenseToUser={handleAssignLicenseToUser}
            onUnassignLicense={handleUnassignLicense}
            onToggleLicenseStatus={handleToggleLicenseStatus}
            generateUniqueCode={generateUniqueCode}
            formatTimestamp={formatTimestamp}
          />
        )}

        {/* TAB 4: ACTIVITY LOGS */}
        {activeTab === 'activity' && (
          <ActivityLogsSection
            logs={auditLogs}
            loadingLogs={loadingLogs}
            onRefresh={() => {
              onShowToast('Activity logs stream refreshed from Firebase');
            }}
            formatTimestamp={formatTimestamp}
          />
        )}

        {/* TAB 5: CONFIGURATION */}
        {activeTab === 'config' && (
          <DeveloperConfigSection
            currentUser={currentUser}
            systemConfig={systemConfig}
            configSaving={configSaving}
            onSaveConfig={handleSaveSystemConfig}
            formatTimestamp={formatTimestamp}
          />
        )}

        {/* TAB 6: FIREBASE DATA MANAGEMENT */}
        {activeTab === 'database' && (
          <div className="space-y-6">
            <div className="bg-[#0E141C] border border-[#1E2633] rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Database size={18} className="text-amber-400" />
                  <span>Firebase Infrastructure &amp; Collection Management</span>
                </h3>
                <p className="text-xs text-white/80">
                  Live monitoring, collection record metrics, and structured database exports.
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handlePingDatabase}
                  disabled={isPinging}
                  className="px-3.5 py-2 rounded-xl bg-[#141A23] hover:bg-[#1A222F] text-white border border-[#232D3B] text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Radio size={14} className="text-blue-400" />
                  <span>{isPinging ? 'Pinging...' : 'Ping Connection'}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-[#0E141C] border border-[#1E2633] rounded-2xl p-5">
                <div className="flex items-center justify-between text-xs text-white/80">
                  <span>/users Collection</span>
                  <Users size={16} className="text-amber-400" />
                </div>
                <div className="text-2xl font-bold text-white font-mono mt-2">{usersList.length}</div>
                <p className="text-[11px] text-white/60 mt-1">Registered agencies and developer accounts</p>
              </div>

              <div className="bg-[#0E141C] border border-[#1E2633] rounded-2xl p-5">
                <div className="flex items-center justify-between text-xs text-white/80">
                  <span>/agency_licenses</span>
                  <Key size={16} className="text-emerald-400" />
                </div>
                <div className="text-2xl font-bold text-emerald-400 font-mono mt-2">{licenses.length}</div>
                <p className="text-[11px] text-white/60 mt-1">Agency license codes stored in Firestore</p>
              </div>

              <div className="bg-[#0E141C] border border-[#1E2633] rounded-2xl p-5">
                <div className="flex items-center justify-between text-xs text-white/80">
                  <span>/developer_audit_logs</span>
                  <Activity size={16} className="text-blue-400" />
                </div>
                <div className="text-2xl font-bold text-blue-400 font-mono mt-2">{auditLogs.length}</div>
                <p className="text-[11px] text-white/60 mt-1">Audit events recorded in Firestore</p>
              </div>

              <div className="bg-[#0E141C] border border-[#1E2633] rounded-2xl p-5">
                <div className="flex items-center justify-between text-xs text-white/80">
                  <span>Live Server Latency</span>
                  <Radio size={16} className="text-purple-400" />
                </div>
                <div className="text-2xl font-bold text-purple-400 font-mono mt-2">
                  {pingLatency ? `${pingLatency} ms` : 'Active'}
                </div>
                <p className="text-[11px] text-white/60 mt-1">Firestore getDocFromServer ping</p>
              </div>
            </div>

            <div className="bg-[#0E141C] border border-[#1E2633] rounded-2xl p-6 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FileJson size={18} className="text-amber-400" />
                <span>JSON Export &amp; Backup Utilities</span>
              </h3>
              <p className="text-xs text-white/80 leading-relaxed">
                Download a secure JSON archive of all registered agencies, active license codes, and recent audit trails for offsite governance and disaster recovery.
              </p>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleExportDataJSON}
                  className="px-4 py-2.5 rounded-xl bg-[#141A23] hover:bg-[#1A222F] border border-[#232D3B] text-xs font-bold text-white inline-flex items-center gap-2 cursor-pointer transition-all shadow-sm"
                >
                  <Download size={15} className="text-amber-400" />
                  <span>Download Full JSON Export Archive</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Delete User Confirmation Modal */}
      <AnimatePresence>
        {userToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0E141C] border border-red-500/40 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4"
            >
              <div className="flex items-center gap-3 text-red-400">
                <AlertTriangle size={24} />
                <h3 className="text-base font-bold text-white">Confirm Account Deletion</h3>
              </div>

              <p className="text-xs text-white/80 leading-relaxed">
                You are deleting the agency document for{' '}
                <strong className="text-white">
                  {userToDelete.information?.agencyName || userToDelete.agencyName || 'this agency'}
                </strong>{' '}
                (UID: <code className="font-mono text-amber-400">{userToDelete.id}</code>).
              </p>

              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-300">
                Type <strong className="font-mono text-white">DELETE</strong> below to confirm.
              </div>

              <input
                type="text"
                placeholder="Type DELETE"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="w-full bg-[#141A23] border border-[#232D3B] rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-red-500"
              />

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setUserToDelete(null);
                    setDeleteConfirmText('');
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#141A23] hover:bg-[#1A222F] text-white/80 border border-[#232D3B] cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleDeleteUser}
                  disabled={isDeleting || deleteConfirmText.trim().toLowerCase() !== 'delete'}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white disabled:opacity-40 cursor-pointer"
                >
                  {isDeleting ? 'Deleting...' : 'Delete Permanently'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Sign Out Confirmation Modal */}
      <AnimatePresence>
        {showLogoutConfirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0E141C] border border-[#232D3B] rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 text-xs"
            >
              <div className="flex items-center gap-3 text-amber-400">
                <div className="p-2.5 rounded-xl bg-amber-500/15">
                  <LogOut size={22} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Confirm Developer Sign Out</h3>
                  <p className="text-[11px] text-white/70">Master Root Session</p>
                </div>
              </div>

              <p className="text-xs text-white/80 leading-relaxed">
                Are you sure you want to end your developer session for{' '}
                <strong className="text-white font-mono">{currentUser.email}</strong>? You will be signed out of Firebase Authentication immediately and returned to the secure login gate.
              </p>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#1E2633]">
                <button
                  type="button"
                  onClick={() => setShowLogoutConfirmModal(false)}
                  disabled={isLoggingOut}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#141A23] hover:bg-[#1A222F] text-white/80 border border-[#232D3B] cursor-pointer"
                >
                  Stay Signed In
                </button>

                <button
                  type="button"
                  onClick={handleExecuteDeveloperLogout}
                  disabled={isLoggingOut}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-500/20 disabled:opacity-40 cursor-pointer flex items-center gap-1.5"
                >
                  <LogOut size={14} className={isLoggingOut ? 'animate-spin' : ''} />
                  <span>{isLoggingOut ? 'Signing out...' : 'Confirm Sign Out'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
