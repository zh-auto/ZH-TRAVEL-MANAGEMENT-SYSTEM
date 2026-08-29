/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import { AuthUser } from '../types';
import {
  Users,
  Search,
  Key,
  CheckCircle2,
  XCircle,
  Clock,
  Building2,
  Mail,
  MapPin,
  Save,
  Check,
  Zap,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';

interface UserManagementViewProps {
  currentUser: AuthUser;
  onShowToast: (message: string, isError?: boolean) => void;
}

interface FirestoreUserData {
  id: string;
  agencyName?: string;
  adminName?: string;
  email?: string;
  agencyLocation?: string;
  agencyCode?: string;
  status?: string;
  accountStatus?: boolean;
  isApproved?: boolean;
  createdAt?: any;
  lastLogin?: any;
  information?: {
    agencyName?: string;
    adminName?: string;
    email?: string;
    agencyLocation?: string;
    registeredAt?: any;
  };
  management?: {
    agencyCode?: string;
    accountStatus?: boolean | string;
    userName?: string;
    activatedAt?: any;
    lastLogin?: any;
    expiresAt?: any;
  };
}

export default function UserManagementView({
  currentUser,
  onShowToast,
}: UserManagementViewProps) {
  const [usersList, setUsersList] = useState<FirestoreUserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [editingCodes, setEditingCodes] = useState<Record<string, string>>({});
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [isActivatingAll, setIsActivatingAll] = useState(false);

  // Real-time listener for all registered users + auto-activate existing users
  useEffect(() => {
    const usersRef = collection(db, 'users');
    let hasAutoMigrated = false;

    const unsub = onSnapshot(
      usersRef,
      async (snap) => {
        const list: FirestoreUserData[] = [];
        const toActivate: string[] = [];

        snap.forEach((d) => {
          const userData = { id: d.id, ...d.data() } as FirestoreUserData;
          list.push(userData);

          // Check if user has not been assigned explicit boolean accountStatus: true
          const mgmtStatus = userData.management?.accountStatus;
          const topStatus = userData.accountStatus;
          if (mgmtStatus !== true || topStatus !== true) {
            // Only auto-upgrade if not explicitly suspended (false)
            if (mgmtStatus !== false && topStatus !== false && userData.status !== 'Suspended' && userData.status !== 'DEACTIVE') {
              toActivate.push(d.id);
            }
          }
        });

        setUsersList(list);
        setLoading(false);

        // One-time auto-migration for existing users to accountStatus: true
        if (!hasAutoMigrated && toActivate.length > 0) {
          hasAutoMigrated = true;
          try {
            const batch = writeBatch(db);
            toActivate.forEach((userId) => {
              const uRef = doc(db, 'users', userId);
              batch.update(uRef, {
                accountStatus: true,
                'management.accountStatus': true,
                status: 'Active',
                isApproved: true,
                'management.activatedAt': serverTimestamp(),
              });
            });
            await batch.commit();
            console.log(`Auto-activated ${toActivate.length} existing users with accountStatus: true`);
          } catch (migrateErr) {
            console.error('Auto-migration error:', migrateErr);
          }
        }
      },
      (err) => {
        console.error('Error fetching users:', err);
        setLoading(false);
        onShowToast('Failed to load agencies list', true);
      }
    );

    return () => unsub();
  }, [onShowToast]);

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

  // Handle Account Status Change (Boolean: true for Active, false for Suspended)
  const handleBooleanStatusChange = async (userId: string, newStatusBool: boolean | 'Pending') => {
    setUpdatingId(userId);
    try {
      const userRef = doc(db, 'users', userId);
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
      onShowToast(
        newStatusBool === true
          ? 'Account status set to: true (Active - চলবে)'
          : newStatusBool === false
          ? 'Account status set to: false (Suspended - বন্ধ)'
          : 'Account status set to: Pending'
      );
    } catch (err) {
      console.error('Error updating status:', err);
      onShowToast('Failed to update status', true);
    } finally {
      setUpdatingId(null);
    }
  };

  // Activate all existing users (Set accountStatus = true in Firestore batch)
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
      onShowToast(`সমস্ত ইউজারকে (${usersList.length} টি) সফলভাবে Active (accountStatus: true) করা হয়েছে!`);
    } catch (err) {
      console.error('Error activating all users:', err);
      onShowToast('Failed to activate all users', true);
    } finally {
      setIsActivatingAll(false);
    }
  };

  // Handle Agency Code Save
  const handleSaveAgencyCode = async (userId: string) => {
    const newCode = editingCodes[userId]?.trim();
    if (newCode === undefined) return;
    setUpdatingId(userId);
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        agencyCode: newCode,
        'management.agencyCode': newCode,
      });
      onShowToast(`Agency Code saved: ${newCode || '(cleared)'}`);
    } catch (err) {
      console.error('Error saving agency code:', err);
      onShowToast('Failed to save agency code', true);
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredUsers = usersList.filter((u) => {
    const agencyName = (u.information?.agencyName || u.agencyName || '').toLowerCase();
    const adminName = (u.information?.adminName || u.adminName || '').toLowerCase();
    const email = (u.information?.email || u.email || '').toLowerCase();
    const code = (u.management?.agencyCode || u.agencyCode || '').toLowerCase();
    const q = searchQuery.toLowerCase();

    const matchesSearch = agencyName.includes(q) || adminName.includes(q) || email.includes(q) || code.includes(q);

    const active = isUserActive(u);
    const suspended = isUserSuspended(u);
    const pending = !active && !suspended;

    let matchesFilter = true;
    if (filterStatus === 'active') matchesFilter = active;
    if (filterStatus === 'suspended') matchesFilter = suspended;
    if (filterStatus === 'pending') matchesFilter = pending;

    return matchesSearch && matchesFilter;
  });

  const totalCount = usersList.length;
  const activeCount = usersList.filter((u) => isUserActive(u)).length;
  const suspendedCount = usersList.filter((u) => isUserSuspended(u)).length;
  const pendingCount = usersList.filter((u) => !isUserActive(u) && !isUserSuspended(u)).length;

  return (
    <div className="space-y-6 animate-fade-in" id="user-management-view">
      {/* Header Banner */}
      <div className="card-glass border border-[var(--border)] rounded-2xl p-6 relative overflow-hidden bg-gradient-to-r from-[var(--panel-bg)] to-[var(--bg)] shadow-md">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="p-2 rounded-xl bg-[var(--accent)]/15 text-[var(--accent)]">
                <Users size={22} />
              </div>
              <h2 className="text-xl font-bold text-[var(--text)]">
                Agency &amp; User Account Management
              </h2>
            </div>
            <p className="text-sm text-[var(--text-muted)]">
              Firebase Firestore-এ অ্যাকাউন্ট স্ট্যাটাস Boolean (<span className="font-mono text-emerald-500 font-bold">true</span> = Active / <span className="font-mono text-red-500 font-bold">false</span> = Suspended) আকারে নির্বাচন ও নিয়ন্ত্রণ করুন।
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Quick Button to Activate All Users */}
            <button
              type="button"
              onClick={handleActivateAllUsers}
              disabled={isActivatingAll || loading || usersList.length === 0}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
              title="Make all registered users active in Firebase (accountStatus: true)"
            >
              <Zap size={14} className={isActivatingAll ? 'animate-spin' : ''} />
              {isActivatingAll ? 'Activating All...' : 'Make All Users Active (true)'}
            </button>

            <div className="flex items-center gap-2 text-xs font-mono bg-[var(--bg)] border border-[var(--border)] px-3 py-1.5 rounded-lg text-[var(--text-muted)]">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              {currentUser.email}
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-[var(--border)]">
          <div className="bg-[var(--bg)]/80 border border-[var(--border)] rounded-xl p-3">
            <span className="text-xs text-[var(--text-muted)] block">Total Agencies</span>
            <span className="text-lg font-bold text-[var(--text)]">{totalCount}</span>
          </div>
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
            <span className="text-xs text-emerald-600 dark:text-emerald-400 block font-medium">true : Active (সক্রিয়)</span>
            <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{activeCount}</span>
          </div>
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
            <span className="text-xs text-red-600 dark:text-red-400 block font-medium">false : Suspended (সাসপেন্ড)</span>
            <span className="text-lg font-bold text-red-600 dark:text-red-400">{suspendedCount}</span>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
            <span className="text-xs text-amber-600 dark:text-amber-400 block font-medium">Pending Approval</span>
            <span className="text-lg font-bold text-amber-600 dark:text-amber-400">{pendingCount}</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search agency, email, admin, code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[var(--panel-bg)] border border-[var(--border)] rounded-xl pl-9 pr-4 py-2 text-sm text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <span className="text-xs text-[var(--text-muted)] whitespace-nowrap font-medium">Filter Status:</span>
          {[
            { id: 'all', label: 'All Agencies' },
            { id: 'active', label: '🟢 true (Active)' },
            { id: 'suspended', label: '🔴 false (Suspended)' },
            { id: 'pending', label: '🟡 Pending' },
          ].map((st) => (
            <button
              key={st.id}
              onClick={() => setFilterStatus(st.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                filterStatus === st.id
                  ? 'bg-[var(--accent)] text-white shadow-sm'
                  : 'bg-[var(--panel-bg)] text-[var(--text-muted)] border border-[var(--border)] hover:text-[var(--text)]'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {/* Agencies List Cards */}
      {loading ? (
        <div className="text-center py-16">
          <div className="w-8 h-8 border-3 border-[var(--accent)]/30 border-t-[var(--accent)] rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-[var(--text-muted)]">Loading agencies from Firestore...</p>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="card-glass border border-[var(--border)] rounded-2xl p-12 text-center text-[var(--text-muted)]">
          <Users size={36} className="mx-auto mb-2 opacity-40" />
          <p className="font-semibold text-base">কোনো এজেন্সি পাওয়া যায়নি</p>
          <p className="text-xs mt-1">অনুগ্রহ করে সার্চ কুয়েরি অথবা ফিল্টার চেক করুন।</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredUsers.map((u) => {
            const agencyName = u.information?.agencyName || u.agencyName || 'Unnamed Agency';
            const adminName = u.information?.adminName || u.adminName || u.management?.userName || 'Admin';
            const email = u.information?.email || u.email || 'No email';
            const location = u.information?.agencyLocation || u.agencyLocation || 'Location not set';
            const assignedCode = u.management?.agencyCode || u.agencyCode || '';
            const currentCodeInput = editingCodes[u.id] !== undefined ? editingCodes[u.id] : assignedCode;
            
            const active = isUserActive(u);
            const suspended = isUserSuspended(u);
            const pending = !active && !suspended;

            // Current select value string
            const selectValue = active ? 'true' : (suspended ? 'false' : 'pending');

            return (
              <div
                key={u.id}
                className={`card-glass border rounded-2xl p-5 transition-all relative ${
                  suspended
                    ? 'border-red-500/30 bg-red-500/5'
                    : active
                    ? 'border-emerald-500/20 bg-emerald-500/5'
                    : 'border-amber-500/20 bg-amber-500/5'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                  {/* Agency Details */}
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="p-2 rounded-lg bg-[var(--accent)]/15 text-[var(--accent)] font-bold text-xs">
                        <Building2 size={16} />
                      </div>
                      <h3 className="text-base font-bold text-[var(--text)]">{agencyName}</h3>

                      {/* Current Status Badge with Boolean Indication */}
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-bold tracking-wider flex items-center gap-1 font-mono ${
                          active
                            ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                            : suspended
                            ? 'bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30'
                            : 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {active && <CheckCircle2 size={12} />}
                        {suspended && <XCircle size={12} />}
                        {pending && <Clock size={12} />}
                        {active ? 'true : Active' : suspended ? 'false : Suspended' : 'Pending'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-[var(--text-muted)] pt-1">
                      <div className="flex items-center gap-1.5">
                        <Users size={14} className="opacity-70" />
                        <span>Admin: <strong className="text-[var(--text)]">{adminName}</strong></span>
                      </div>
                      <div className="flex items-center gap-1.5 truncate">
                        <Mail size={14} className="opacity-70" />
                        <span className="truncate">{email}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <MapPin size={14} className="opacity-70" />
                        <span>{location}</span>
                      </div>
                    </div>
                  </div>

                  {/* Interactive Controls: Boolean Option Select & Agency Code */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 border-t lg:border-t-0 pt-4 lg:pt-0 border-[var(--border)]">
                    {/* Agency Code Input & Save */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-semibold text-[var(--text-muted)] flex items-center gap-1">
                        <Key size={12} /> Agency Code
                      </label>
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={currentCodeInput}
                          placeholder="@AgencyCode@"
                          onChange={(e) =>
                            setEditingCodes((prev) => ({ ...prev, [u.id]: e.target.value }))
                          }
                          className="bg-[var(--bg)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text)] font-mono focus:outline-none focus:border-[var(--accent)] w-36"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveAgencyCode(u.id)}
                          disabled={updatingId === u.id}
                          className="p-1.5 rounded-lg bg-[var(--panel-bg)] hover:bg-[var(--accent)] hover:text-white text-[var(--text-muted)] border border-[var(--border)] transition-colors cursor-pointer"
                          title="Save Agency Code"
                        >
                          <Save size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Account Status Selector (Boolean Option Dropdown) */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-semibold text-[var(--text-muted)] flex items-center gap-1">
                        <Check size={12} /> Account Status (Boolean Option)
                      </label>
                      <select
                        value={selectValue}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === 'true') handleBooleanStatusChange(u.id, true);
                          else if (val === 'false') handleBooleanStatusChange(u.id, false);
                          else handleBooleanStatusChange(u.id, 'Pending');
                        }}
                        disabled={updatingId === u.id}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer focus:outline-none font-mono ${
                          active
                            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400'
                            : suspended
                            ? 'bg-red-500/15 border-red-500/40 text-red-600 dark:text-red-400'
                            : 'bg-amber-500/15 border-amber-500/40 text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        <option value="true" className="bg-[var(--panel-bg)] text-[var(--text)] font-sans">
                          🟢 true (Active - চলবে)
                        </option>
                        <option value="false" className="bg-[var(--panel-bg)] text-[var(--text)] font-sans">
                          🔴 false (Suspend - বন্ধ)
                        </option>
                        <option value="pending" className="bg-[var(--panel-bg)] text-[var(--text)] font-sans">
                          🟡 Pending (অপেক্ষমাণ)
                        </option>
                      </select>
                    </div>

                    {/* Quick 1-Click Action Buttons */}
                    <div className="flex items-center gap-1.5 self-end sm:self-center pt-2 sm:pt-4">
                      <button
                        type="button"
                        onClick={() => handleBooleanStatusChange(u.id, true)}
                        disabled={updatingId === u.id || active}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                          active
                            ? 'bg-emerald-500 text-white shadow-sm cursor-default'
                            : 'bg-emerald-500/10 hover:bg-emerald-500/25 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                        }`}
                        title="Set accountStatus = true"
                      >
                        <CheckCircle2 size={13} />
                        true (Active)
                      </button>

                      <button
                        type="button"
                        onClick={() => handleBooleanStatusChange(u.id, false)}
                        disabled={updatingId === u.id || suspended}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                          suspended
                            ? 'bg-red-500 text-white shadow-sm cursor-default'
                            : 'bg-red-500/10 hover:bg-red-500/25 text-red-600 dark:text-red-400 border border-red-500/30'
                        }`}
                        title="Set accountStatus = false"
                      >
                        <XCircle size={13} />
                        false (Suspend)
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
