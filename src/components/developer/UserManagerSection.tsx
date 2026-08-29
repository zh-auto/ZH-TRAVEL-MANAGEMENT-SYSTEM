/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  Users,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Building2,
  Mail,
  MapPin,
  Save,
  Check,
  Zap,
  Lock,
  Trash2,
  Edit3,
  Calendar,
  Activity,
  X,
  UserCheck,
  UserX,
  Key,
  ChevronRight,
  Eye,
  Shield,
  Database,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { FirestoreUserData } from './types';

interface UserManagerSectionProps {
  usersList: FirestoreUserData[];
  loadingUsers: boolean;
  updatingId: string | null;
  sendingResetId: string | null;
  isActivatingAll: boolean;
  onStatusChange: (userId: string, newStatus: boolean | 'Pending') => Promise<void>;
  onActivateAll: () => Promise<void>;
  onSaveAgencyCode: (userId: string, code?: string) => Promise<void>;
  onSendPasswordReset: (user: FirestoreUserData) => Promise<void>;
  onDeleteClick: (user: FirestoreUserData) => void;
  onSaveUserInfo: (userId: string, updatedInfo: { agencyName: string; adminName: string; agencyLocation: string; email: string }) => Promise<void>;
  formatTimestamp: (ts: any) => string;
  isUserActive: (u: FirestoreUserData) => boolean;
  isUserSuspended: (u: FirestoreUserData) => boolean;
  onInspectUserData?: (user: FirestoreUserData) => void;
}

export default function UserManagerSection({
  usersList,
  loadingUsers,
  updatingId,
  sendingResetId,
  isActivatingAll,
  onStatusChange,
  onActivateAll,
  onSaveAgencyCode,
  onSendPasswordReset,
  onDeleteClick,
  onSaveUserInfo,
  formatTimestamp,
  isUserActive,
  isUserSuspended,
  onInspectUserData,
}: UserManagerSectionProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [editingCodes, setEditingCodes] = useState<Record<string, string>>({});
  
  // Edit User Details Modal
  const [editingUser, setEditingUser] = useState<FirestoreUserData | null>(null);
  const [editAgencyName, setEditAgencyName] = useState('');
  const [editAdminName, setEditAdminName] = useState('');
  const [editAgencyLocation, setEditAgencyLocation] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [isSavingUser, setIsSavingUser] = useState(false);

  // Edit / Change Agency Code Modal State
  const [editingCodeUser, setEditingCodeUser] = useState<FirestoreUserData | null>(null);
  const [newCodeInput, setNewCodeInput] = useState('');
  const [isSavingCode, setIsSavingCode] = useState(false);

  // View User Full Details Modal
  const [viewingUser, setViewingUser] = useState<FirestoreUserData | null>(null);

  // Agency Code Duplicate Check
  const duplicateUser = useMemo(() => {
    if (!editingCodeUser || !newCodeInput.trim()) return null;
    const target = newCodeInput.trim().toUpperCase();
    return usersList.find(
      (u) =>
        u.id !== editingCodeUser.id &&
        (u.management?.agencyCode || u.agencyCode || u.loginId || '').trim().toUpperCase() === target
    );
  }, [editingCodeUser, newCodeInput, usersList]);

  // Generate Unique Agency Code Helper
  const handleGenerateUniqueCode = (prefix = 'ZH-SNT-') => {
    const existing = new Set(
      usersList.map((u) => (u.management?.agencyCode || u.agencyCode || u.loginId || '').trim().toUpperCase())
    );
    let candidate = '';
    let attempts = 0;
    do {
      const num = Math.floor(1000 + Math.random() * 9000);
      candidate = `${prefix}${num}`;
      attempts++;
    } while (existing.has(candidate.toUpperCase()) && attempts < 100);
    setNewCodeInput(candidate);
  };

  const openCodeModal = (u: FirestoreUserData) => {
    setEditingCodeUser(u);
    const curr = u.management?.agencyCode || u.agencyCode || u.loginId || '';
    setNewCodeInput(curr);
  };

  const handleSaveCodeModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCodeUser) return;
    if (duplicateUser) return;
    setIsSavingCode(true);
    try {
      await onSaveAgencyCode(editingCodeUser.id, newCodeInput.trim());
      setEditingCodeUser(null);
    } finally {
      setIsSavingCode(false);
    }
  };

  const filteredUsers = useMemo(() => {
    return usersList.filter((u) => {
      const agencyName = (u.information?.agencyName || u.agencyName || '').toLowerCase();
      const adminName = (u.information?.adminName || u.adminName || '').toLowerCase();
      const email = (u.information?.email || u.email || '').toLowerCase();
      const code = (u.management?.agencyCode || u.agencyCode || '').toLowerCase();
      const uid = u.id.toLowerCase();
      const q = searchQuery.toLowerCase();

      const matchesSearch =
        agencyName.includes(q) ||
        adminName.includes(q) ||
        email.includes(q) ||
        code.includes(q) ||
        uid.includes(q);

      const active = isUserActive(u);
      const suspended = isUserSuspended(u);
      const pending = !active && !suspended;

      let matchesFilter = true;
      if (filterStatus === 'active') matchesFilter = active;
      if (filterStatus === 'suspended') matchesFilter = suspended;
      if (filterStatus === 'pending') matchesFilter = pending;
      if (filterStatus === 'nocode') matchesFilter = code.trim() === '';

      return matchesSearch && matchesFilter;
    });
  }, [usersList, searchQuery, filterStatus, isUserActive, isUserSuspended]);

  const openEditModal = (u: FirestoreUserData) => {
    setEditingUser(u);
    setEditAgencyName(u.information?.agencyName || u.agencyName || '');
    setEditAdminName(u.information?.adminName || u.adminName || u.management?.userName || '');
    setEditAgencyLocation(u.information?.agencyLocation || u.agencyLocation || '');
    setEditEmail(u.information?.email || u.email || '');
  };

  const handleSaveEditModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setIsSavingUser(true);
    try {
      await onSaveUserInfo(editingUser.id, {
        agencyName: editAgencyName.trim(),
        adminName: editAdminName.trim(),
        agencyLocation: editAgencyLocation.trim(),
        email: editEmail.trim(),
      });
      setEditingUser(null);
    } finally {
      setIsSavingUser(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar with Search, Filters & Batch Activation */}
      <div className="bg-[#0E141C] p-4 rounded-2xl border border-[#1E2633] flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-96">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/60" />
            <input
              type="text"
              placeholder="Search agency, admin, email, code, UID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#141A23] border border-[#232D3B] rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder:text-white/50 focus:outline-none focus:border-amber-400"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onActivateAll}
              disabled={isActivatingAll || loadingUsers || usersList.length === 0}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50 cursor-pointer whitespace-nowrap"
            >
              <Zap size={14} className={isActivatingAll ? 'animate-spin' : ''} />
              <span>{isActivatingAll ? 'Activating...' : 'Activate All'}</span>
            </button>
          </div>
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-xs text-white/80 whitespace-nowrap font-medium">Filter:</span>
          {[
            { id: 'all', label: `All (${usersList.length})` },
            { id: 'active', label: `🟢 Active (${usersList.filter(isUserActive).length})` },
            { id: 'suspended', label: `🔴 Suspended (${usersList.filter(isUserSuspended).length})` },
            { id: 'pending', label: `🟡 Pending (${usersList.filter((u) => !isUserActive(u) && !isUserSuspended(u)).length})` },
            { id: 'nocode', label: '⚠️ Unassigned Code' },
          ].map((st) => (
            <button
              key={st.id}
              onClick={() => setFilterStatus(st.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                filterStatus === st.id
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'bg-[#141A23] text-white/80 border border-[#232D3B] hover:text-white hover:bg-[#1A222F]'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {/* Users Dynamic Card List */}
      {loadingUsers ? (
        <div className="text-center py-20 bg-[#0E141C] rounded-2xl border border-[#1E2633]">
          <div className="w-8 h-8 border-3 border-amber-400/30 border-t-amber-400 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-white/80">Loading dynamic agency records from Firestore...</p>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="bg-[#0E141C] border border-[#1E2633] rounded-2xl p-12 text-center text-white/80">
          <Users size={36} className="mx-auto mb-2 opacity-30 text-amber-400" />
          <p className="font-bold text-sm text-white">No agencies match your criteria</p>
          <p className="text-xs mt-1 text-white/70">Try adjusting your search keywords or filter status.</p>
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

            const regDate = formatTimestamp(u.information?.registeredAt || u.createdAt);
            const lastLoginDate = formatTimestamp(u.management?.lastLogin || u.lastLogin);
            const lastActivityDate = formatTimestamp(u.lastActivity || u.management?.lastLogin || u.lastLogin || u.createdAt);

            return (
              <div
                key={u.id}
                className={`bg-[#0E141C] border rounded-2xl p-5 transition-all relative ${
                  suspended
                    ? 'border-red-500/30 bg-red-500/5'
                    : active
                    ? 'border-emerald-500/20 bg-emerald-500/5'
                    : 'border-amber-500/20 bg-amber-500/5'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
                  {/* Agency Core Info */}
                  <div className="space-y-3 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <div className="p-2.5 rounded-xl bg-amber-500/15 text-amber-400 font-bold">
                        <Building2 size={20} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base font-bold text-white">{agencyName}</h3>
                          <span
                            className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold font-mono tracking-wider flex items-center gap-1 ${
                              active
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : suspended
                                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            }`}
                          >
                            {active && <CheckCircle2 size={12} />}
                            {suspended && <XCircle size={12} />}
                            {pending && <Clock size={12} />}
                            {active ? 'Active' : suspended ? 'Suspended / Deactive' : 'Pending Review'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Information Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs text-white/80">
                      <div className="flex items-center gap-1.5">
                        <Users size={14} className="text-white/60" />
                        <span>Admin: <strong className="text-white">{adminName}</strong></span>
                      </div>
                      <div className="flex items-center gap-1.5 truncate">
                        <Mail size={14} className="text-white/60" />
                        <span className="truncate text-white/90 font-mono">{email}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <MapPin size={14} className="text-white/60" />
                        <span className="text-white/90">{location}</span>
                      </div>
                    </div>

                    {/* Timestamps & Tracking Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-[#1E2633] text-[11px] font-mono">
                      <div className="flex items-center gap-1.5 text-white/80">
                        <Calendar size={13} className="text-blue-400" />
                        <span>Registered:</span>
                        <strong className="text-white">{regDate}</strong>
                      </div>
                      <div className="flex items-center gap-1.5 text-white/80">
                        <Clock size={13} className="text-emerald-400" />
                        <span>Last Login:</span>
                        <strong className="text-white">{lastLoginDate}</strong>
                      </div>
                      <div className="flex items-center gap-1.5 text-white/80">
                        <Activity size={13} className="text-amber-400" />
                        <span>Last Activity:</span>
                        <strong className="text-white">{lastActivityDate}</strong>
                      </div>
                    </div>

                    {/* UID and Agency Code Badge */}
                    <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-white/70 font-mono">
                      <span>UID: <strong className="text-white/90">{u.id}</strong></span>
                      <span>Agency Code: <strong className={assignedCode ? 'text-amber-400 font-bold' : 'text-white/50'}>{assignedCode || 'None'}</strong></span>
                    </div>
                  </div>

                  {/* Actions & Controls */}
                  <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-stretch sm:items-center lg:items-end xl:items-center gap-2.5 border-t lg:border-t-0 pt-4 lg:pt-0 border-[#1E2633]">
                    
                    {/* Quick State Toggle Buttons: Activate / Deactivate / Suspend */}
                    <div className="flex items-center gap-1.5 bg-[#141A23] p-1 rounded-xl border border-[#232D3B]">
                      <button
                        type="button"
                        onClick={() => onStatusChange(u.id, true)}
                        disabled={updatingId === u.id || active}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                          active
                            ? 'bg-emerald-500 text-white shadow-sm'
                            : 'text-white/80 hover:text-emerald-400 hover:bg-emerald-500/10'
                        }`}
                        title="Activate User (accountStatus: true)"
                      >
                        <UserCheck size={13} />
                        <span>Activate</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onStatusChange(u.id, false)}
                        disabled={updatingId === u.id || suspended}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                          suspended
                            ? 'bg-red-500 text-white shadow-sm'
                            : 'text-white/80 hover:text-red-400 hover:bg-red-500/10'
                        }`}
                        title="Deactivate / Suspend User (accountStatus: false)"
                      >
                        <UserX size={13} />
                        <span>Deactivate</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onStatusChange(u.id, 'Pending')}
                        disabled={updatingId === u.id || pending}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                          pending
                            ? 'bg-amber-500 text-white shadow-sm'
                            : 'text-white/80 hover:text-amber-400 hover:bg-amber-500/10'
                        }`}
                        title="Set Pending"
                      >
                        <Clock size={13} />
                        <span>Pending</span>
                      </button>
                    </div>

                    {/* Edit Agency Code Action Button */}
                    <button
                      type="button"
                      onClick={() => openCodeModal(u)}
                      className="px-3 py-2 rounded-xl text-xs font-semibold bg-[#141A23] hover:bg-[#1A222F] text-amber-400 border border-[#232D3B] hover:border-amber-500/40 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      title="Edit / Change Agency Code (Active Login Identifier)"
                    >
                      <Key size={13} />
                      <span>{assignedCode ? 'Edit Code' : 'Assign Code'}</span>
                    </button>

                    {/* Edit Info Button */}
                    <button
                      type="button"
                      onClick={() => openEditModal(u)}
                      className="px-3 py-2 rounded-xl text-xs font-semibold bg-[#141A23] hover:bg-[#1A222F] text-white/80 hover:text-white border border-[#232D3B] hover:border-amber-500/40 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      title="Edit Permitted User Information"
                    >
                      <Edit3 size={13} />
                      <span>Edit Info</span>
                    </button>

                    {/* View User Live Data (Trips & Bookings) Button */}
                    {onInspectUserData && (
                      <button
                        type="button"
                        onClick={() => onInspectUserData(u)}
                        className="px-3 py-2 rounded-xl text-xs font-bold bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/40 hover:border-amber-500 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                        title="Inspect Live Bus Trips, Bookings, & Settings in Data Explorer"
                      >
                        <Database size={13} />
                        <span>View Data</span>
                      </button>
                    )}

                    {/* View Details Button */}
                    <button
                      type="button"
                      onClick={() => setViewingUser(u)}
                      className="p-2 rounded-xl text-xs font-semibold bg-[#141A23] hover:bg-[#1A222F] text-white/80 hover:text-white border border-[#232D3B] transition-all cursor-pointer"
                      title="View Full Profile Details"
                    >
                      <Eye size={14} />
                    </button>

                    {/* Trigger Password Reset Link */}
                    <button
                      type="button"
                      onClick={() => onSendPasswordReset(u)}
                      disabled={sendingResetId === u.id}
                      className="p-2 rounded-xl text-xs font-semibold bg-[#141A23] hover:bg-[#1A222F] text-white/80 hover:text-amber-400 border border-[#232D3B] transition-all cursor-pointer"
                      title="Send Official Firebase Password Reset Email"
                    >
                      <Lock size={14} className={sendingResetId === u.id ? 'animate-spin' : ''} />
                    </button>

                    {/* Delete Account */}
                    <button
                      type="button"
                      onClick={() => onDeleteClick(u)}
                      className="p-2 rounded-xl text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 transition-all cursor-pointer"
                      title="Delete User Document from Firestore"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Permitted User Information Modal */}
      <AnimatePresence>
        {editingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0E141C] border border-[#232D3B] rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4 text-xs"
            >
              <div className="flex items-center justify-between border-b border-[#1E2633] pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400">
                    <Edit3 size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Edit Permitted User Information</h3>
                    <p className="text-[11px] text-white/70">UID: {editingUser.id}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="text-white/70 hover:text-white p-1"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveEditModal} className="space-y-3.5">
                <div className="space-y-1">
                  <label className="text-white/80 font-medium block">Agency Name</label>
                  <input
                    type="text"
                    required
                    value={editAgencyName}
                    onChange={(e) => setEditAgencyName(e.target.value)}
                    className="w-full bg-[#141A23] border border-[#232D3B] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-white/80 font-medium block">Admin / Contact Name</label>
                  <input
                    type="text"
                    required
                    value={editAdminName}
                    onChange={(e) => setEditAdminName(e.target.value)}
                    className="w-full bg-[#141A23] border border-[#232D3B] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-white/80 font-medium block">Email Address</label>
                  <input
                    type="email"
                    required
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full bg-[#141A23] border border-[#232D3B] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-white/80 font-medium block">Agency Location</label>
                  <input
                    type="text"
                    value={editAgencyLocation}
                    onChange={(e) => setEditAgencyLocation(e.target.value)}
                    className="w-full bg-[#141A23] border border-[#232D3B] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#1E2633]">
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="px-4 py-2 rounded-xl bg-[#141A23] hover:bg-[#1A222F] text-white/80 border border-[#232D3B] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingUser}
                    className="px-4 py-2 rounded-xl font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/20 cursor-pointer flex items-center gap-1.5"
                  >
                    <Save size={14} />
                    <span>{isSavingUser ? 'Saving...' : 'Save to Firebase'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit / Change Agency Code Modal */}
      <AnimatePresence>
        {editingCodeUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0E141C] border border-amber-500/40 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4 text-xs"
            >
              <div className="flex items-center justify-between border-b border-[#1E2633] pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400">
                    <Key size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Edit / Change Agency Code</h3>
                    <p className="text-[11px] text-white/70">
                      Set the active unique login code for{' '}
                      <strong className="text-amber-400">
                        {editingCodeUser.information?.agencyName || editingCodeUser.agencyName || 'Agency'}
                      </strong>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingCodeUser(null)}
                  className="text-white/70 hover:text-white p-1"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Target User Summary Box */}
              <div className="p-3 bg-[#141A23] rounded-xl border border-[#232D3B] space-y-1.5 font-mono text-[11px]">
                <div className="flex justify-between text-white/80">
                  <span>Target Agency:</span>
                  <strong className="text-white font-sans">
                    {editingCodeUser.information?.agencyName || editingCodeUser.agencyName || 'N/A'}
                  </strong>
                </div>
                <div className="flex justify-between text-white/80">
                  <span>Admin Contact:</span>
                  <span className="text-white">
                    {editingCodeUser.information?.adminName || editingCodeUser.adminName || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between text-white/80">
                  <span>Registered Email:</span>
                  <span className="text-white">{editingCodeUser.information?.email || editingCodeUser.email || 'N/A'}</span>
                </div>
                <div className="flex justify-between text-white/80 pt-1 border-t border-[#1E2633]">
                  <span>Current Agency Code:</span>
                  <strong className="text-amber-400">
                    {editingCodeUser.management?.agencyCode || editingCodeUser.agencyCode || '(None / Unassigned)'}
                  </strong>
                </div>
              </div>

              <form onSubmit={handleSaveCodeModal} className="space-y-3.5">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-white/80 font-medium block">
                      New Agency Code <span className="text-red-400">*</span>
                    </label>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleGenerateUniqueCode()}
                        className="text-[11px] font-bold text-amber-400 hover:text-amber-300 hover:underline inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Zap size={11} />
                        <span>Generate Unique Code</span>
                      </button>
                      <span className="text-white/40">|</span>
                      <button
                        type="button"
                        onClick={() => setNewCodeInput('')}
                        className="text-[11px] font-medium text-red-400 hover:text-red-300 hover:underline cursor-pointer"
                      >
                        Revoke / Clear
                      </button>
                    </div>
                  </div>

                  <input
                    type="text"
                    placeholder="e.g. ZH-SNT-1024 or CUSTOM-CODE"
                    value={newCodeInput}
                    onChange={(e) => setNewCodeInput(e.target.value.toUpperCase())}
                    className={`w-full bg-[#141A23] border rounded-xl px-3.5 py-2.5 text-xs text-white font-mono tracking-wider focus:outline-none ${
                      duplicateUser
                        ? 'border-red-500 text-red-400 focus:border-red-500'
                        : 'border-[#232D3B] focus:border-amber-400'
                    }`}
                  />
                  <p className="text-[11px] text-white/60">
                    This code becomes the active login identifier for this agency immediately upon saving.
                  </p>
                </div>

                {/* Duplicate Code Error Alert */}
                {duplicateUser && (
                  <div className="p-3 bg-red-500/15 border border-red-500/30 rounded-xl text-xs text-red-300 space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-red-400">
                      <XCircle size={14} />
                      <span>Duplicate Agency Code Detected!</span>
                    </div>
                    <p className="text-[11px] leading-relaxed">
                      The code <strong className="font-mono text-white">{newCodeInput.trim()}</strong> is already active for{' '}
                      <strong className="text-white">
                        {duplicateUser.information?.agencyName || duplicateUser.agencyName || 'another agency'}
                      </strong>{' '}
                      ({duplicateUser.information?.email || duplicateUser.email}). Agency Codes must be strictly unique across all users.
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#1E2633]">
                  <button
                    type="button"
                    onClick={() => setEditingCodeUser(null)}
                    className="px-4 py-2 rounded-xl bg-[#141A23] hover:bg-[#1A222F] text-white/80 border border-[#232D3B] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingCode || !!duplicateUser}
                    className="px-4 py-2 rounded-xl font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/20 disabled:opacity-40 cursor-pointer flex items-center gap-1.5"
                  >
                    <Save size={14} />
                    <span>{isSavingCode ? 'Saving to Firebase...' : 'Save Agency Code'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* View User Information Detail Modal */}
      <AnimatePresence>
        {viewingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0E141C] border border-[#232D3B] rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4 text-xs"
            >
              <div className="flex items-center justify-between border-b border-[#1E2633] pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-blue-500/15 text-blue-400">
                    <Building2 size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">User &amp; Agency Complete Profile</h3>
                    <p className="text-[11px] text-white/70">Firestore Document Breakdown</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setViewingUser(null)}
                  className="text-white/70 hover:text-white p-1"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3 font-mono">
                <div className="p-3 bg-[#141A23] rounded-xl border border-[#232D3B] space-y-1.5">
                  <div className="text-[11px] text-white/80">Document ID (UID):</div>
                  <div className="text-amber-400 font-bold break-all">{viewingUser.id}</div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="p-3 bg-[#141A23] rounded-xl border border-[#232D3B]">
                    <div className="text-[11px] text-white/80">Agency Name:</div>
                    <div className="text-white font-bold mt-0.5">{viewingUser.information?.agencyName || viewingUser.agencyName || 'N/A'}</div>
                  </div>
                  <div className="p-3 bg-[#141A23] rounded-xl border border-[#232D3B]">
                    <div className="text-[11px] text-white/80">Admin Contact:</div>
                    <div className="text-white font-bold mt-0.5">{viewingUser.information?.adminName || viewingUser.adminName || viewingUser.management?.userName || 'N/A'}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="p-3 bg-[#141A23] rounded-xl border border-[#232D3B]">
                    <div className="text-[11px] text-white/80">Email Address:</div>
                    <div className="text-white truncate mt-0.5">{viewingUser.information?.email || viewingUser.email || 'N/A'}</div>
                  </div>
                  <div className="p-3 bg-[#141A23] rounded-xl border border-[#232D3B]">
                    <div className="text-[11px] text-white/80">Agency Location:</div>
                    <div className="text-white truncate mt-0.5">{viewingUser.information?.agencyLocation || viewingUser.agencyLocation || 'N/A'}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="p-3 bg-[#141A23] rounded-xl border border-[#232D3B]">
                    <div className="text-[11px] text-white/80">Agency Code / License:</div>
                    <div className="text-amber-400 font-bold mt-0.5">{viewingUser.management?.agencyCode || viewingUser.agencyCode || 'Unassigned'}</div>
                  </div>
                  <div className="p-3 bg-[#141A23] rounded-xl border border-[#232D3B]">
                    <div className="text-[11px] text-white/80">Account Status:</div>
                    <div className={isUserActive(viewingUser) ? 'text-emerald-400 font-bold mt-0.5' : 'text-red-400 font-bold mt-0.5'}>
                      {isUserActive(viewingUser) ? 'Active (true)' : 'Suspended / Inactive'}
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-[#141A23] rounded-xl border border-[#232D3B] space-y-1">
                  <div className="flex justify-between text-white/80">
                    <span>Registration Date:</span>
                    <span className="text-white">{formatTimestamp(viewingUser.information?.registeredAt || viewingUser.createdAt)}</span>
                  </div>
                  <div className="flex justify-between text-white/80">
                    <span>Last Login:</span>
                    <span className="text-white">{formatTimestamp(viewingUser.management?.lastLogin || viewingUser.lastLogin)}</span>
                  </div>
                  <div className="flex justify-between text-white/80">
                    <span>Last Activity:</span>
                    <span className="text-white">{formatTimestamp(viewingUser.lastActivity || viewingUser.management?.lastLogin || viewingUser.lastLogin || viewingUser.createdAt)}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-[#1E2633]">
                {onInspectUserData ? (
                  <button
                    type="button"
                    onClick={() => {
                      const target = viewingUser;
                      setViewingUser(null);
                      onInspectUserData(target);
                    }}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md shadow-amber-500/20"
                  >
                    <Database size={14} />
                    <span>Inspect Trips &amp; Bookings Data →</span>
                  </button>
                ) : (
                  <div />
                )}
                <button
                  type="button"
                  onClick={() => setViewingUser(null)}
                  className="px-4 py-2 rounded-xl bg-[#141A23] hover:bg-[#1A222F] text-white/80 border border-[#232D3B] cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
