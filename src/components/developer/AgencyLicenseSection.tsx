/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Key,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Sparkles,
  Save,
  Trash2,
  Edit2,
  Check,
  X,
  UserCheck,
  UserX,
  Users,
  Shield,
  Building2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AgencyLicense, FirestoreUserData } from './types';

interface AgencyLicenseSectionProps {
  licenses: AgencyLicense[];
  usersList: FirestoreUserData[];
  loadingLicenses: boolean;
  onCreateLicense: (code: string, status: 'active' | 'deactive', notes?: string) => Promise<void>;
  onUpdateLicense: (licenseId: string, updates: Partial<AgencyLicense>) => Promise<void>;
  onDeleteLicense: (licenseId: string, code: string) => Promise<void>;
  onAssignLicenseToUser: (licenseId: string, code: string, userId: string) => Promise<void>;
  onUnassignLicense: (licenseId: string, code: string) => Promise<void>;
  onToggleLicenseStatus: (licenseId: string, code: string, currentStatus: 'active' | 'deactive') => Promise<void>;
  generateUniqueCode: () => string;
  formatTimestamp: (ts: any) => string;
}

export default function AgencyLicenseSection({
  licenses,
  usersList,
  loadingLicenses,
  onCreateLicense,
  onUpdateLicense,
  onDeleteLicense,
  onAssignLicenseToUser,
  onUnassignLicense,
  onToggleLicenseStatus,
  generateUniqueCode,
  formatTimestamp,
}: AgencyLicenseSectionProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterAssignment, setFilterAssignment] = useState<string>('all');

  // Create Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newStatus, setNewStatus] = useState<'active' | 'deactive'>('active');
  const [newNotes, setNewNotes] = useState('');
  const [newAssignUserId, setNewAssignUserId] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Edit Modal
  const [editingLicense, setEditingLicense] = useState<AgencyLicense | null>(null);
  const [editCode, setEditCode] = useState('');
  const [editStatus, setEditStatus] = useState<'active' | 'deactive'>('active');
  const [editNotes, setEditNotes] = useState('');
  const [editAssignUserId, setEditAssignUserId] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Quick Inline Assign
  const [assigningLicenseId, setAssigningLicenseId] = useState<string | null>(null);
  const [selectedUserForAssign, setSelectedUserForAssign] = useState<string>('');

  // Delete Confirm
  const [licenseToDelete, setLicenseToDelete] = useState<AgencyLicense | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Filtered Licenses
  const filteredLicenses = licenses.filter((lic) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      (lic.code || '').toLowerCase().includes(q) ||
      (lic.assignedAgencyName || '').toLowerCase().includes(q) ||
      (lic.assignedEmail || '').toLowerCase().includes(q) ||
      (lic.notes || '').toLowerCase().includes(q);

    let matchesStatus = true;
    if (filterStatus === 'active') matchesStatus = lic.status === 'active';
    if (filterStatus === 'deactive') matchesStatus = lic.status === 'deactive';

    let matchesAssign = true;
    if (filterAssignment === 'assigned') matchesAssign = Boolean(lic.assignedUserId);
    if (filterAssignment === 'unassigned') matchesAssign = !lic.assignedUserId;

    return matchesSearch && matchesStatus && matchesAssign;
  });

  const openCreateModal = () => {
    setNewCode(generateUniqueCode());
    setNewStatus('active');
    setNewNotes('');
    setNewAssignUserId('');
    setShowCreateModal(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim()) return;
    setIsCreating(true);
    try {
      await onCreateLicense(newCode.trim(), newStatus, newNotes.trim());
      if (newAssignUserId) {
        // Will assign after creation or user can assign directly
      }
      setShowCreateModal(false);
    } finally {
      setIsCreating(false);
    }
  };

  const openEditModal = (lic: AgencyLicense) => {
    setEditingLicense(lic);
    setEditCode(lic.code);
    setEditStatus(lic.status);
    setEditNotes(lic.notes || '');
    setEditAssignUserId(lic.assignedUserId || '');
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLicense || !editCode.trim()) return;
    setIsSavingEdit(true);
    try {
      const updates: Partial<AgencyLicense> = {
        code: editCode.trim(),
        status: editStatus,
        notes: editNotes.trim(),
      };

      await onUpdateLicense(editingLicense.id, updates);

      // Handle user assignment change
      if (editAssignUserId !== (editingLicense.assignedUserId || '')) {
        if (editAssignUserId) {
          await onAssignLicenseToUser(editingLicense.id, editCode.trim(), editAssignUserId);
        } else {
          await onUnassignLicense(editingLicense.id, editCode.trim());
        }
      }

      setEditingLicense(null);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!licenseToDelete) return;
    setIsDeleting(true);
    try {
      await onDeleteLicense(licenseToDelete.id, licenseToDelete.code);
      setLicenseToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const activeCount = licenses.filter((l) => l.status === 'active').length;
  const assignedCount = licenses.filter((l) => Boolean(l.assignedUserId)).length;

  return (
    <div className="space-y-6">
      {/* Top Banner with Stats & Create Code Button */}
      <div className="bg-[#0E141C] border border-[#1E2633] rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Key size={18} className="text-amber-400" />
            <span>Agency Code / License Management</span>
          </h3>
          <p className="text-xs text-white/80">
            Create, edit, activate/deactivate, and assign agency codes to registered users in Firebase.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-xs text-white/80 font-mono bg-[#141A23] border border-[#232D3B] px-3 py-1.5 rounded-xl hidden sm:flex items-center gap-3">
            <div>
              Total: <strong className="text-white">{licenses.length}</strong>
            </div>
            <div>
              Active: <strong className="text-emerald-400">{activeCount}</strong>
            </div>
            <div>
              Assigned: <strong className="text-amber-400">{assignedCount}</strong>
            </div>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition-all cursor-pointer whitespace-nowrap"
          >
            <Plus size={15} />
            <span>Create Agency Code</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-[#0E141C] p-4 rounded-2xl border border-[#1E2633] flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/60" />
          <input
            type="text"
            placeholder="Search code, agency name, email, notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#141A23] border border-[#232D3B] rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder:text-white/50 focus:outline-none focus:border-amber-400 font-mono"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
          <div className="flex items-center gap-1.5 bg-[#141A23] p-1 rounded-xl border border-[#232D3B]">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                filterStatus === 'all' ? 'bg-amber-500 text-white' : 'text-white/80 hover:text-white'
              }`}
            >
              All Status
            </button>
            <button
              onClick={() => setFilterStatus('active')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                filterStatus === 'active' ? 'bg-emerald-500 text-white' : 'text-white/80 hover:text-white'
              }`}
            >
              Active
            </button>
            <button
              onClick={() => setFilterStatus('deactive')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                filterStatus === 'deactive' ? 'bg-red-500 text-white' : 'text-white/80 hover:text-white'
              }`}
            >
              Deactive
            </button>
          </div>

          <div className="flex items-center gap-1.5 bg-[#141A23] p-1 rounded-xl border border-[#232D3B]">
            <button
              onClick={() => setFilterAssignment('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                filterAssignment === 'all' ? 'bg-amber-500 text-white' : 'text-white/80 hover:text-white'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterAssignment('assigned')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                filterAssignment === 'assigned' ? 'bg-blue-500 text-white' : 'text-white/80 hover:text-white'
              }`}
            >
              Assigned
            </button>
            <button
              onClick={() => setFilterAssignment('unassigned')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                filterAssignment === 'unassigned' ? 'bg-purple-500 text-white' : 'text-white/80 hover:text-white'
              }`}
            >
              Available
            </button>
          </div>
        </div>
      </div>

      {/* Licenses Matrix Table */}
      <div className="bg-[#0E141C] border border-[#1E2633] rounded-2xl overflow-hidden shadow-xl">
        {loadingLicenses ? (
          <div className="py-20 text-center text-xs text-white/80">
            <div className="w-8 h-8 border-3 border-amber-400/30 border-t-amber-400 rounded-full animate-spin mx-auto mb-3" />
            Loading agency codes from Firebase Firestore...
          </div>
        ) : filteredLicenses.length === 0 ? (
          <div className="p-12 text-center text-white/80">
            <Key size={36} className="mx-auto mb-2 opacity-30 text-amber-400" />
            <p className="font-bold text-sm text-white">No agency codes found</p>
            <p className="text-xs mt-1 text-white/70">
              Click &quot;Create Agency Code&quot; to generate license keys for agency login.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#141A23] text-white/90 border-b border-[#1E2633] uppercase font-mono text-[11px]">
                <tr>
                  <th className="p-4">Agency Code</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Assigned User / Agency</th>
                  <th className="p-4">Created Date</th>
                  <th className="p-4">Notes</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E2633]">
                {filteredLicenses.map((lic) => {
                  const isAssigned = Boolean(lic.assignedUserId);
                  const isActive = lic.status === 'active';

                  return (
                    <tr key={lic.id} className="hover:bg-[#141A23]/50 transition-colors">
                      {/* Code Display */}
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-sm text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                            {lic.code}
                          </span>
                        </div>
                      </td>

                      {/* Status & Activate / Deactivate Toggle */}
                      <td className="p-4">
                        <button
                          type="button"
                          onClick={() => onToggleLicenseStatus(lic.id, lic.code, lic.status)}
                          className={`text-[11px] px-2.5 py-1 rounded-lg font-bold font-mono inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                            isActive
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30'
                              : 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
                          }`}
                          title={`Click to ${isActive ? 'Deactivate' : 'Activate'}`}
                        >
                          {isActive ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                          <span>{isActive ? 'Active' : 'Deactive'}</span>
                        </button>
                      </td>

                      {/* Assignment */}
                      <td className="p-4">
                        {isAssigned ? (
                          <div className="space-y-0.5">
                            <div className="font-bold text-white flex items-center gap-1.5">
                              <Building2 size={13} className="text-amber-400" />
                              <span>{lic.assignedAgencyName || 'Agency'}</span>
                            </div>
                            <div className="text-[11px] text-white/80 font-mono truncate max-w-[200px]">
                              {lic.assignedEmail || lic.assignedUserId}
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-mono text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                              Available / Unassigned
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Created Date */}
                      <td className="p-4 text-[11px] font-mono text-white/80">
                        {formatTimestamp(lic.createdAt)}
                      </td>

                      {/* Notes */}
                      <td className="p-4 text-[11px] text-white/80 max-w-[150px] truncate">
                        {lic.notes || '—'}
                      </td>

                      {/* Actions */}
                      <td className="p-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {/* Quick Assign / Change User Modal Trigger */}
                          <button
                            type="button"
                            onClick={() => openEditModal(lic)}
                            className="p-1.5 rounded-lg bg-[#141A23] hover:bg-[#1A222F] text-white/80 hover:text-amber-400 border border-[#232D3B] transition-all cursor-pointer"
                            title="Edit Code &amp; User Assignment"
                          >
                            <Edit2 size={13} />
                          </button>

                          {isAssigned && (
                            <button
                              type="button"
                              onClick={() => onUnassignLicense(lic.id, lic.code)}
                              className="px-2 py-1.5 rounded-lg bg-[#141A23] hover:bg-orange-500/20 text-orange-400 border border-[#232D3B] hover:border-orange-500/30 text-[10px] font-mono font-bold transition-all cursor-pointer"
                              title="Unassign Code from User"
                            >
                              Unlink
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => setLicenseToDelete(lic)}
                            className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 transition-all cursor-pointer"
                            title="Delete Code from Firestore"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Agency Code Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0E141C] border border-[#232D3B] rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 text-xs"
            >
              <div className="flex items-center justify-between border-b border-[#1E2633] pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400">
                    <Key size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Create Agency Code</h3>
                    <p className="text-[11px] text-white/70">Generate a new license key in Firebase</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="text-white/70 hover:text-white p-1"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-white/80 font-medium block">Agency Code / Key</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      required
                      value={newCode}
                      onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                      className="w-full bg-[#141A23] border border-[#232D3B] rounded-xl px-3.5 py-2.5 text-xs text-amber-400 font-mono font-bold focus:outline-none focus:border-amber-400 uppercase"
                    />
                    <button
                      type="button"
                      onClick={() => setNewCode(generateUniqueCode())}
                      className="px-3 py-2.5 rounded-xl bg-[#141A23] hover:bg-[#1A222F] text-amber-400 border border-[#232D3B] hover:border-amber-500/40 transition-all font-semibold flex items-center gap-1 whitespace-nowrap cursor-pointer"
                      title="Generate random code"
                    >
                      <Sparkles size={13} />
                      <span>Random</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-white/80 font-medium block">Status</label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as any)}
                    className="w-full bg-[#141A23] border border-[#232D3B] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value="active">Active (Can be used for login)</option>
                    <option value="deactive">Deactive (Disabled)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-white/80 font-medium block">Notes (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Standard Agency License 2026"
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    className="w-full bg-[#141A23] border border-[#232D3B] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#1E2633]">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 rounded-xl bg-[#141A23] hover:bg-[#1A222F] text-white/80 border border-[#232D3B] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreating || !newCode.trim()}
                    className="px-4 py-2 rounded-xl font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/20 cursor-pointer flex items-center gap-1.5"
                  >
                    <Plus size={14} />
                    <span>{isCreating ? 'Creating...' : 'Create Code'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit & Assign Modal */}
      <AnimatePresence>
        {editingLicense && (
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
                    <Edit2 size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Edit Agency Code &amp; Assignment</h3>
                    <p className="text-[11px] text-white/70">ID: {editingLicense.id}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingLicense(null)}
                  className="text-white/70 hover:text-white p-1"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-white/80 font-medium block">Agency Code</label>
                  <input
                    type="text"
                    required
                    value={editCode}
                    onChange={(e) => setEditCode(e.target.value.toUpperCase())}
                    className="w-full bg-[#141A23] border border-[#232D3B] rounded-xl px-3.5 py-2.5 text-xs text-amber-400 font-mono font-bold focus:outline-none focus:border-amber-400 uppercase"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-white/80 font-medium block">Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as any)}
                    className="w-full bg-[#141A23] border border-[#232D3B] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400 font-mono"
                  >
                    <option value="active">Active</option>
                    <option value="deactive">Deactive</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-white/80 font-medium block">Assign to Agency User</label>
                  <select
                    value={editAssignUserId}
                    onChange={(e) => setEditAssignUserId(e.target.value)}
                    className="w-full bg-[#141A23] border border-[#232D3B] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400 font-mono"
                  >
                    <option value="">-- Unassigned (Available in Pool) --</option>
                    {usersList.map((u) => {
                      const agencyName = u.information?.agencyName || u.agencyName || 'Agency';
                      const email = u.information?.email || u.email || '';
                      return (
                        <option key={u.id} value={u.id}>
                          {agencyName} ({email}) - UID: {u.id.slice(0, 8)}...
                        </option>
                      );
                    })}
                  </select>
                  <p className="text-[11px] text-white/60">
                    Selecting a user will bind this Agency Code directly to their Firestore profile.
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-white/80 font-medium block">Notes</label>
                  <input
                    type="text"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    className="w-full bg-[#141A23] border border-[#232D3B] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#1E2633]">
                  <button
                    type="button"
                    onClick={() => setEditingLicense(null)}
                    className="px-4 py-2 rounded-xl bg-[#141A23] hover:bg-[#1A222F] text-white/80 border border-[#232D3B] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingEdit || !editCode.trim()}
                    className="px-4 py-2 rounded-xl font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/20 cursor-pointer flex items-center gap-1.5"
                  >
                    <Save size={14} />
                    <span>{isSavingEdit ? 'Saving...' : 'Save Changes'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete License Confirm Modal */}
      <AnimatePresence>
        {licenseToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0E141C] border border-red-500/40 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 text-xs"
            >
              <div className="flex items-center gap-3 text-red-400">
                <Trash2 size={22} />
                <h3 className="text-sm font-bold text-white">Delete Agency Code</h3>
              </div>

              <p className="text-white/80 leading-relaxed">
                Are you sure you want to permanently delete Agency Code{' '}
                <strong className="font-mono text-amber-400">{licenseToDelete.code}</strong> from Firebase?
              </p>

              {licenseToDelete.assignedAgencyName && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-300">
                  ⚠️ This code is currently assigned to{' '}
                  <strong>{licenseToDelete.assignedAgencyName}</strong>. Deleting it will revoke their code.
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setLicenseToDelete(null)}
                  className="px-4 py-2 rounded-xl bg-[#141A23] hover:bg-[#1A222F] text-white/80 border border-[#232D3B] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteConfirm}
                  disabled={isDeleting}
                  className="px-4 py-2 rounded-xl font-bold bg-red-600 hover:bg-red-700 text-white cursor-pointer"
                >
                  {isDeleting ? 'Deleting...' : 'Delete Code'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
