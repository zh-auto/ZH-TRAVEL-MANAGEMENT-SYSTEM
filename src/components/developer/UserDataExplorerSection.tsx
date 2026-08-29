/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  collection,
  onSnapshot,
  doc,
  getDocs,
  query,
  where,
  getDoc,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { Trip, Settings, SeatInfo } from '../../types';
import { FirestoreUserData } from './types';
import { SEAT_LAYOUT, ALL_SEAT_IDS, seatStats, formatTaka, formatDate } from '../../utils';
import { ZH_OFFICIAL_LOGO } from '../../assets/logo';
import {
  Search,
  Building2,
  Users,
  Calendar,
  Clock,
  MapPin,
  Mail,
  Key,
  Shield,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Bus,
  FileSpreadsheet,
  Download,
  Copy,
  Check,
  RefreshCw,
  Eye,
  Sliders,
  Database,
  ArrowRight,
  ChevronRight,
  Phone,
  Ticket,
  DollarSign,
  UserCheck,
  Sparkles,
  Layers,
  FileText,
  Printer,
  Info,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface UserDataExplorerSectionProps {
  usersList: FirestoreUserData[];
  loadingUsers: boolean;
  selectedUserId?: string | null;
  onSelectUser?: (userId: string) => void;
  formatTimestamp: (ts: any) => string;
  isUserActive: (u: FirestoreUserData) => boolean;
  isUserSuspended: (u: FirestoreUserData) => boolean;
}

export default function UserDataExplorerSection({
  usersList,
  loadingUsers,
  selectedUserId: initialSelectedUserId,
  onSelectUser,
  formatTimestamp,
  isUserActive,
  isUserSuspended,
}: UserDataExplorerSectionProps) {
  // State for active selected user
  const [selectedUser, setSelectedUser] = useState<FirestoreUserData | null>(() => {
    if (initialSelectedUserId) {
      return usersList.find((u) => u.id === initialSelectedUserId) || usersList[0] || null;
    }
    return usersList[0] || null;
  });

  // Search & Filter state for user selector
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState<'all' | 'active' | 'suspended' | 'pending'>('all');

  // Sub-tabs for the selected user's data view
  const [activeSubTab, setActiveSubTab] = useState<'trips' | 'settings' | 'passengers' | 'raw_json'>('trips');

  // Selected User's Real-time Data
  const [userTrips, setUserTrips] = useState<Record<string, Trip>>({});
  const [userSettings, setUserSettings] = useState<Settings | null>(null);
  const [loadingTrips, setLoadingTrips] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(false);

  // Selected Trip for detailed Seat Matrix & Passenger List
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [tripSearchQuery, setTripSearchQuery] = useState('');
  const [passengerSearchQuery, setPassengerSearchQuery] = useState('');

  // Copy feedback states
  const [copiedId, setCopiedId] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);

  // Sync selectedUser if initialSelectedUserId changes
  useEffect(() => {
    if (initialSelectedUserId) {
      const found = usersList.find((u) => u.id === initialSelectedUserId);
      if (found) {
        setSelectedUser(found);
      }
    } else if (!selectedUser && usersList.length > 0) {
      setSelectedUser(usersList[0]);
    }
  }, [initialSelectedUserId, usersList]);

  // Real-time listener for the selected user's trips from `users/{userId}/trips`
  useEffect(() => {
    if (!selectedUser?.id) {
      setUserTrips({});
      return;
    }

    setLoadingTrips(true);
    const tripsRef = collection(db, 'users', selectedUser.id, 'trips');

    const unsubTrips = onSnapshot(
      tripsRef,
      async (snap) => {
        const tripsMap: Record<string, Trip> = {};
        snap.forEach((docSnap) => {
          tripsMap[docSnap.id] = { id: docSnap.id, ...(docSnap.data() as any) };
        });

        // If no trips in subcollection, check legacy path `data/{agencyName}/trips` with ownerUid match
        if (Object.keys(tripsMap).length === 0) {
          const agencyKey = selectedUser.information?.agencyName || selectedUser.agencyName || '';
          if (agencyKey) {
            try {
              const legacyRef = collection(db, 'data', agencyKey, 'trips');
              const qLegacy = query(legacyRef, where('ownerUid', '==', selectedUser.id));
              const legSnap = await getDocs(qLegacy);
              legSnap.forEach((lDoc) => {
                tripsMap[lDoc.id] = { id: lDoc.id, ...(lDoc.data() as any) };
              });
            } catch (e) {
              // ignore legacy errors
            }
          }
        }

        setUserTrips(tripsMap);
        setLoadingTrips(false);

        // Auto-select first trip if none selected or previous selected trip no longer exists
        const tripKeys = Object.keys(tripsMap);
        if (tripKeys.length > 0) {
          setSelectedTripId((prev) => (prev && tripsMap[prev] ? prev : tripKeys[0]));
        } else {
          setSelectedTripId(null);
        }
      },
      (err) => {
        console.warn('Developer User Trips Fetch Note:', err);
        setLoadingTrips(false);
      }
    );

    return () => unsubTrips();
  }, [selectedUser?.id]);

  // Real-time listener for the selected user's settings from `users/{userId}/settings/config`
  useEffect(() => {
    if (!selectedUser?.id) {
      setUserSettings(null);
      return;
    }

    setLoadingSettings(true);
    const settingsRef = doc(db, 'users', selectedUser.id, 'settings', 'config');

    const unsubSettings = onSnapshot(
      settingsRef,
      async (snap) => {
        if (snap.exists()) {
          setUserSettings(snap.data() as Settings);
        } else {
          // Check legacy `data/{agencyName}/settings/config`
          const agencyKey = selectedUser.information?.agencyName || selectedUser.agencyName || '';
          if (agencyKey) {
            try {
              const legSettingsRef = doc(db, 'data', agencyKey, 'settings', 'config');
              const legSnap = await getDoc(legSettingsRef);
              if (legSnap.exists()) {
                setUserSettings(legSnap.data() as Settings);
              } else {
                setUserSettings(null);
              }
            } catch (e) {
              setUserSettings(null);
            }
          } else {
            setUserSettings(null);
          }
        }
        setLoadingSettings(false);
      },
      (err) => {
        console.warn('Developer User Settings Fetch Note:', err);
        setLoadingSettings(false);
      }
    );

    return () => unsubSettings();
  }, [selectedUser?.id]);

  // Filtered Users List for the Left Selector
  const filteredUsers = useMemo(() => {
    return usersList.filter((u) => {
      const agencyName = (u.information?.agencyName || u.agencyName || '').toLowerCase();
      const adminName = (u.information?.adminName || u.adminName || '').toLowerCase();
      const email = (u.information?.email || u.email || '').toLowerCase();
      const code = (u.management?.agencyCode || u.agencyCode || u.loginId || '').toLowerCase();
      const uid = u.id.toLowerCase();
      const q = userSearchQuery.toLowerCase();

      const matchesSearch =
        agencyName.includes(q) ||
        adminName.includes(q) ||
        email.includes(q) ||
        code.includes(q) ||
        uid.includes(q);

      const active = isUserActive(u);
      const suspended = isUserSuspended(u);

      if (userStatusFilter === 'active' && !active) return false;
      if (userStatusFilter === 'suspended' && !suspended) return false;
      if (userStatusFilter === 'pending' && (active || suspended)) return false;

      return matchesSearch;
    });
  }, [usersList, userSearchQuery, userStatusFilter, isUserActive, isUserSuspended]);

  // Calculate Aggregated Metrics for the Selected User
  const userMetrics = useMemo(() => {
    const tripsArray = Object.values(userTrips) as Trip[];
    let totalTrips = tripsArray.length;
    let totalBookedSeats = 0;
    let totalAvailableSeats = 0;
    let totalRevenue = 0;

    tripsArray.forEach((t) => {
      const st = seatStats(t);
      totalBookedSeats += st.booked;
      totalAvailableSeats += st.available;

      ALL_SEAT_IDS.forEach((seatId) => {
        const s = t.seats?.[seatId];
        if (s && (s.status === 'booked' || s.status === 'reserved')) {
          totalRevenue += Number(s.fee) || 0;
        }
      });
    });

    const totalSeats = totalBookedSeats + totalAvailableSeats;
    const occupancyRate = totalSeats > 0 ? Math.round((totalBookedSeats / totalSeats) * 100) : 0;

    return {
      totalTrips,
      totalBookedSeats,
      totalAvailableSeats,
      totalRevenue,
      occupancyRate,
    };
  }, [userTrips]);

  // Current Active Trip selected for Seat Layout & Passengers
  const currentTrip = useMemo(() => {
    if (!selectedTripId) return null;
    return userTrips[selectedTripId] || null;
  }, [selectedTripId, userTrips]);

  // Filtered Trips List
  const filteredTripsList = useMemo(() => {
    const list = Object.values(userTrips) as Trip[];
    if (!tripSearchQuery.trim()) return list;
    const q = tripSearchQuery.toLowerCase();
    return list.filter(
      (t) =>
        t.route?.toLowerCase().includes(q) ||
        t.busName?.toLowerCase().includes(q) ||
        t.date?.includes(q) ||
        t.time?.includes(q)
    );
  }, [userTrips, tripSearchQuery]);

  // Passenger Bookings for the Current Selected Trip
  const currentTripBookings = useMemo(() => {
    if (!currentTrip) return [];
    const list = ALL_SEAT_IDS.map((seatId) => {
      const s = currentTrip.seats?.[seatId];
      if (s && (s.status === 'booked' || s.status === 'reserved')) {
        return {
          seatId,
          ...s,
        };
      }
      return null;
    }).filter((item): item is NonNullable<typeof item> => item !== null);

    if (!passengerSearchQuery.trim()) return list;
    const q = passengerSearchQuery.toLowerCase();
    return list.filter(
      (b) =>
        b.seatId.toLowerCase().includes(q) ||
        b.name?.toLowerCase().includes(q) ||
        b.phone?.includes(q) ||
        b.boarding?.toLowerCase().includes(q) ||
        b.drop?.toLowerCase().includes(q)
    );
  }, [currentTrip, passengerSearchQuery]);

  // Handle Copy User ID
  const handleCopyUserId = () => {
    if (!selectedUser) return;
    navigator.clipboard.writeText(selectedUser.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  // Handle Export Single User Data as JSON
  const handleDownloadUserJSON = () => {
    if (!selectedUser) return;
    const exportData = {
      exportedAt: new Date().toISOString(),
      userProfile: selectedUser,
      settings: userSettings,
      trips: userTrips,
      metrics: userMetrics,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const agencySlug = (selectedUser.information?.agencyName || selectedUser.agencyName || 'user')
      .replace(/[^a-zA-Z0-9]/g, '_')
      .toLowerCase();
    a.download = `user_data_${agencySlug}_${selectedUser.id.substring(0, 8)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Handle Copy Full JSON
  const handleCopyJSON = () => {
    if (!selectedUser) return;
    const exportData = {
      exportedAt: new Date().toISOString(),
      userProfile: selectedUser,
      settings: userSettings,
      trips: userTrips,
      metrics: userMetrics,
    };
    navigator.clipboard.writeText(JSON.stringify(exportData, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  return (
    <div className="space-y-6" id="user-data-explorer-section">
      {/* Top Banner & Description */}
      <div className="bg-[#0E141C] border border-[#1E2633] rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
              <Database size={18} />
            </div>
            <h2 className="text-sm sm:text-base font-extrabold text-white uppercase font-display tracking-wider">
              Developer User Data Explorer (ইউজার ডাটা এক্সপ্লোরার)
            </h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              Live Real-Time Sync
            </span>
          </div>
          <p className="text-xs text-white/80">
            Inspect, audit, and analyze any travel agency user's live bus schedules, seat bookings, counter settings, and passenger logs directly from Firestore.
          </p>
        </div>

        {selectedUser && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleDownloadUserJSON}
              className="px-3.5 py-2 rounded-xl bg-[#141A23] hover:bg-[#1A222F] text-white border border-[#232D3B] text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm hover:border-amber-500/30"
              title="Download complete JSON snapshot of this user's data"
            >
              <Download size={14} className="text-amber-400" />
              <span>Export User JSON</span>
            </button>
            <button
              type="button"
              onClick={handleCopyJSON}
              className="px-3.5 py-2 rounded-xl bg-[#141A23] hover:bg-[#1A222F] text-white border border-[#232D3B] text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
              title="Copy complete JSON payload to clipboard"
            >
              {copiedJson ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} className="text-white/70" />}
              <span>{copiedJson ? 'Copied JSON!' : 'Copy JSON'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Split Layout: Left User Selector Sidebar + Right Deep Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: User Directory & Quick Selector (4 cols on lg) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-[#0E141C] border border-[#1E2633] rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Users size={15} className="text-amber-400" />
                <span>Select Agency / User ({filteredUsers.length})</span>
              </span>
              <span className="text-[10px] text-white/60 font-mono">
                Total: {usersList.length}
              </span>
            </div>

            {/* Search Box */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50" />
              <input
                type="text"
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                placeholder="Search name, code, email..."
                className="w-full pl-9 pr-3 py-2 bg-[#141A23] border border-[#232D3B] rounded-xl text-xs text-white placeholder-white/40 focus:outline-none focus:border-amber-500 transition-all"
              />
              {userSearchQuery && (
                <button
                  type="button"
                  onClick={() => setUserSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px]">
              {(['all', 'active', 'suspended', 'pending'] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setUserStatusFilter(filter)}
                  className={`px-2.5 py-1 rounded-lg font-semibold capitalize transition-all cursor-pointer whitespace-nowrap ${
                    userStatusFilter === filter
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'bg-[#141A23] text-white/70 hover:text-white border border-[#232D3B]'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>

            {/* User List Scroll Container */}
            <div className="max-h-[560px] overflow-y-auto divide-y divide-[#1A222F] pr-1 space-y-1">
              {loadingUsers ? (
                <div className="py-12 text-center text-xs text-white/60">
                  <div className="w-5 h-5 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin mx-auto mb-2" />
                  Loading user directory...
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="py-10 text-center text-xs text-white/60 space-y-1">
                  <p>No matching users found.</p>
                </div>
              ) : (
                filteredUsers.map((u) => {
                  const isSelected = selectedUser?.id === u.id;
                  const active = isUserActive(u);
                  const suspended = isUserSuspended(u);
                  const code = u.management?.agencyCode || u.agencyCode || u.loginId || '';
                  const agencyName = u.information?.agencyName || u.agencyName || 'Agency';
                  const adminName = u.information?.adminName || u.adminName || u.displayName || 'Admin';
                  const email = u.information?.email || u.email || '';

                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => {
                        setSelectedUser(u);
                        if (onSelectUser) onSelectUser(u.id);
                      }}
                      className={`w-full p-3 rounded-xl text-left transition-all cursor-pointer flex items-start justify-between gap-2.5 ${
                        isSelected
                          ? 'bg-gradient-to-r from-amber-500/20 to-amber-600/10 border border-amber-500/40 shadow-md shadow-amber-500/5'
                          : 'bg-[#121822] hover:bg-[#161F2C] border border-transparent'
                      }`}
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-white truncate">
                            {agencyName}
                          </span>
                          {u.role === 'developer' && (
                            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                              DEV
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] text-white/70 truncate flex items-center gap-1">
                          <span>{adminName}</span>
                          {code && (
                            <>
                              <span>•</span>
                              <span className="font-mono text-amber-400 font-bold">{code}</span>
                            </>
                          )}
                        </p>

                        <p className="text-[10px] text-white/50 font-mono truncate">{email}</p>
                      </div>

                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                            active
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : suspended
                              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                              : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          }`}
                        >
                          {active ? 'Active' : suspended ? 'Suspended' : 'Pending'}
                        </span>
                        <ChevronRight
                          size={14}
                          className={`transition-transform ${isSelected ? 'text-amber-400 translate-x-0.5' : 'text-white/30'}`}
                        />
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Deep Inspector & Data Views (8 cols on lg) */}
        <div className="lg:col-span-8 space-y-6">
          {!selectedUser ? (
            <div className="bg-[#0E141C] border border-[#1E2633] rounded-2xl p-12 text-center text-white/70 space-y-2">
              <Users size={36} className="mx-auto opacity-30 text-amber-400" />
              <h3 className="text-sm font-bold text-white">No User Selected</h3>
              <p className="text-xs text-white/60">
                Select an agency from the left directory to view full trips, seat matrix, and counter settings.
              </p>
            </div>
          ) : (
            <>
              {/* Selected User Header Card */}
              <div className="bg-[#0E141C] border border-[#1E2633] rounded-2xl p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-[#141A23] border border-amber-500/30 flex items-center justify-center text-amber-400 font-extrabold text-base shadow-lg shadow-black/40 flex-shrink-0">
                      {(selectedUser.information?.agencyName || selectedUser.agencyName || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-extrabold text-white font-display">
                          {selectedUser.information?.agencyName || selectedUser.agencyName || 'Agency Name'}
                        </h3>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isUserActive(selectedUser)
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : isUserSuspended(selectedUser)
                              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                              : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          }`}
                        >
                          {isUserActive(selectedUser) ? 'ACTIVE' : isUserSuspended(selectedUser) ? 'SUSPENDED' : 'PENDING'}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-white/70 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Users size={12} className="text-white/50" />
                          <span>Admin: <strong className="text-white">{selectedUser.information?.adminName || selectedUser.adminName || selectedUser.displayName || 'Admin'}</strong></span>
                        </span>
                        <span className="flex items-center gap-1">
                          <Key size={12} className="text-amber-400" />
                          <span>Code: <strong className="text-amber-400 font-mono">{selectedUser.management?.agencyCode || selectedUser.agencyCode || selectedUser.loginId || 'Unassigned'}</strong></span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={handleCopyUserId}
                      className="px-2.5 py-1.5 rounded-xl bg-[#141A23] hover:bg-[#1A222F] border border-[#232D3B] text-[11px] font-mono text-white/70 hover:text-white flex items-center gap-1 transition-all cursor-pointer"
                      title="Copy full Firestore User UID"
                    >
                      {copiedId ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      <span>{copiedId ? 'UID Copied!' : `UID: ${selectedUser.id.substring(0, 8)}...`}</span>
                    </button>
                  </div>
                </div>

                {/* Additional Info Pill Bar */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-[#1A222F] text-xs">
                  <div className="flex items-center gap-2 text-white/70 truncate">
                    <Mail size={13} className="text-white/40 flex-shrink-0" />
                    <span className="font-mono truncate">{selectedUser.information?.email || selectedUser.email || '—'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-white/70 truncate">
                    <MapPin size={13} className="text-white/40 flex-shrink-0" />
                    <span className="truncate">{selectedUser.information?.agencyLocation || selectedUser.agencyLocation || 'Location not set'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-white/70 truncate">
                    <Calendar size={13} className="text-white/40 flex-shrink-0" />
                    <span>Registered: {formatTimestamp(selectedUser.createdAt || selectedUser.information?.registeredAt)}</span>
                  </div>
                </div>
              </div>

              {/* Aggregated Real-time Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-[#0E141C] border border-[#1E2633] rounded-2xl p-4">
                  <div className="flex items-center justify-between text-xs text-white/70">
                    <span>Total Trips</span>
                    <Bus size={15} className="text-amber-400" />
                  </div>
                  <div className="text-2xl font-extrabold text-white font-mono mt-1.5">
                    {userMetrics.totalTrips}
                  </div>
                  <span className="text-[10px] text-white/50">Stored in subcollection</span>
                </div>

                <div className="bg-[#0E141C] border border-[#1E2633] rounded-2xl p-4">
                  <div className="flex items-center justify-between text-xs text-emerald-400">
                    <span>Booked Seats</span>
                    <Ticket size={15} />
                  </div>
                  <div className="text-2xl font-extrabold text-emerald-400 font-mono mt-1.5">
                    {userMetrics.totalBookedSeats}
                  </div>
                  <span className="text-[10px] text-white/50">{userMetrics.occupancyRate}% Occupancy</span>
                </div>

                <div className="bg-[#0E141C] border border-[#1E2633] rounded-2xl p-4">
                  <div className="flex items-center justify-between text-xs text-amber-400">
                    <span>Total Collection</span>
                    <DollarSign size={15} />
                  </div>
                  <div className="text-2xl font-extrabold text-amber-400 font-mono mt-1.5">
                    {formatTaka(userMetrics.totalRevenue)}
                  </div>
                  <span className="text-[10px] text-white/50">Ticket Fare Sum</span>
                </div>

                <div className="bg-[#0E141C] border border-[#1E2633] rounded-2xl p-4">
                  <div className="flex items-center justify-between text-xs text-blue-400">
                    <span>Available Seats</span>
                    <UserCheck size={15} />
                  </div>
                  <div className="text-2xl font-extrabold text-blue-400 font-mono mt-1.5">
                    {userMetrics.totalAvailableSeats}
                  </div>
                  <span className="text-[10px] text-white/50">Ready to Book</span>
                </div>
              </div>

              {/* SUB-TABS NAVIGATION */}
              <div className="flex items-center gap-2 border-b border-[#1E2633] pb-2 overflow-x-auto">
                {[
                  { id: 'trips', label: 'Trips & Bus Schedules', icon: Bus, count: userMetrics.totalTrips },
                  { id: 'settings', label: 'Agency & Print Settings', icon: Sliders, count: userSettings ? 'Configured' : 'Default' },
                  { id: 'passengers', label: 'Passenger Roster', icon: Users, count: userMetrics.totalBookedSeats },
                  { id: 'raw_json', label: 'Raw Firestore JSON', icon: FileSpreadsheet, count: null },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeSubTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveSubTab(tab.id as any)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                        isActive
                          ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                          : 'bg-[#121822] text-white/70 hover:text-white border border-[#202A38]'
                      }`}
                    >
                      <Icon size={14} />
                      <span>{tab.label}</span>
                      {tab.count !== null && (
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded-md font-mono ${
                            isActive ? 'bg-black/30 text-white' : 'bg-[#1C2634] text-white/80'
                          }`}
                        >
                          {tab.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* SUB-TAB 1: TRIPS & BUS SCHEDULES */}
              {activeSubTab === 'trips' && (
                <div className="space-y-4">
                  {/* Trip Search and Controls */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0E141C] border border-[#1E2633] p-3.5 rounded-2xl">
                    <div className="relative flex-1">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50" />
                      <input
                        type="text"
                        value={tripSearchQuery}
                        onChange={(e) => setTripSearchQuery(e.target.value)}
                        placeholder="Search trips by route, date, or bus name..."
                        className="w-full pl-9 pr-3 py-2 bg-[#141A23] border border-[#232D3B] rounded-xl text-xs text-white placeholder-white/40 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <span className="text-xs text-white/60 whitespace-nowrap font-mono">
                      Showing {filteredTripsList.length} of {userMetrics.totalTrips} trips
                    </span>
                  </div>

                  {loadingTrips ? (
                    <div className="py-16 text-center text-xs text-white/60 bg-[#0E141C] rounded-2xl border border-[#1E2633]">
                      <div className="w-6 h-6 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin mx-auto mb-2" />
                      Loading trips from Firestore subcollection...
                    </div>
                  ) : filteredTripsList.length === 0 ? (
                    <div className="py-14 text-center text-white/70 bg-[#0E141C] rounded-2xl border border-[#1E2633] space-y-2 p-6">
                      <Bus size={32} className="mx-auto opacity-30 text-amber-400" />
                      <p className="text-sm font-bold text-white">No Trips Found For This User</p>
                      <p className="text-xs text-white/60">
                        This agency has not created any bus trips yet, or no trips match the search query.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {filteredTripsList.map((trip) => {
                        const isSelected = selectedTripId === trip.id;
                        const st = seatStats(trip);
                        const fillPct = Math.round((st.booked / st.total) * 100);

                        let tripFareCollection = 0;
                        ALL_SEAT_IDS.forEach((seatId) => {
                          const s = trip.seats?.[seatId];
                          if (s && (s.status === 'booked' || s.status === 'reserved')) {
                            tripFareCollection += Number(s.fee) || 0;
                          }
                        });

                        return (
                          <div
                            key={trip.id}
                            className={`rounded-2xl border transition-all p-4 space-y-3 cursor-pointer ${
                              isSelected
                                ? 'bg-gradient-to-br from-[#141A23] to-[#182230] border-amber-500/50 shadow-lg shadow-amber-500/5'
                                : 'bg-[#0E141C] border-[#1E2633] hover:border-[#2C394B]'
                            }`}
                            onClick={() => setSelectedTripId(trip.id)}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="space-y-1 min-w-0">
                                <span className="font-extrabold text-sm text-white block truncate">
                                  {trip.route || trip.tripName || 'Untitled Trip'}
                                </span>
                                <div className="flex items-center gap-2 text-xs text-white/70 flex-wrap">
                                  <span className="flex items-center gap-1">
                                    <Bus size={12} className="text-amber-400" />
                                    <strong className="text-white">{trip.busName || 'ZH Travel'}</strong>
                                  </span>
                                  <span>•</span>
                                  <span className="flex items-center gap-1 font-mono">
                                    <Calendar size={12} className="text-white/50" />
                                    {formatDate(trip.date)}
                                  </span>
                                  <span>•</span>
                                  <span className="flex items-center gap-1 font-mono">
                                    <Clock size={12} className="text-white/50" />
                                    {trip.time || '—'}
                                  </span>
                                </div>
                              </div>

                              <div className="text-right flex-shrink-0">
                                <span className="text-xs font-extrabold font-mono text-amber-400 block">
                                  {formatTaka(tripFareCollection)}
                                </span>
                                <span className="text-[10px] text-white/50">Collection</span>
                              </div>
                            </div>

                            {/* Progress Fill Bar */}
                            <div className="space-y-1 pt-1">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="text-white/70">Seats: <strong className="text-emerald-400">{st.booked}</strong> / {st.total}</span>
                                <span className="font-mono text-white/90 font-bold">{fillPct}% Booked</span>
                              </div>
                              <div className="w-full h-2 bg-[#1A222F] rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-emerald-500 to-amber-500 transition-all rounded-full"
                                  style={{ width: `${fillPct}%` }}
                                />
                              </div>
                            </div>

                            <div className="flex items-center justify-between pt-1 text-[11px] text-white/60">
                              <span className="font-mono">Trip ID: {trip.id.substring(0, 10)}</span>
                              <span className="text-amber-400 font-semibold flex items-center gap-1">
                                {isSelected ? 'Viewing Seats & Bookings ↓' : 'Click to Inspect Details →'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Trip Deep Inspector: Interactive Bus Seat Layout + Passenger Manifest */}
                  {currentTrip && (
                    <div className="bg-[#0E141C] border border-amber-500/30 rounded-2xl p-5 space-y-6 mt-6 shadow-xl shadow-black/40">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1E2633] pb-4">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30">
                              ACTIVE TRIP INSPECTOR
                            </span>
                            <h4 className="text-base font-extrabold text-white font-display">
                              {currentTrip.route}
                            </h4>
                          </div>
                          <p className="text-xs text-white/70">
                            {currentTrip.busName} • Date: {formatDate(currentTrip.date)} • Departure: {currentTrip.time}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1.5 text-xs">
                            <span className="w-3 h-3 rounded bg-[#1A2330] border border-[#2B384A]" />
                            <span className="text-white/60 text-[11px]">Available</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs ml-2">
                            <span className="w-3 h-3 rounded bg-emerald-500" />
                            <span className="text-emerald-400 font-semibold text-[11px]">Booked</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs ml-2">
                            <span className="w-3 h-3 rounded bg-amber-500" />
                            <span className="text-amber-400 font-semibold text-[11px]">Reserved</span>
                          </div>
                        </div>
                      </div>

                      {/* Visual 2-2 Bus Seat Layout */}
                      <div className="bg-[#121822] border border-[#1E2633] rounded-2xl p-5 space-y-3">
                        <div className="flex items-center justify-between text-xs text-white/70 mb-2">
                          <span className="font-bold text-white flex items-center gap-1.5">
                            <Bus size={14} className="text-amber-400" />
                            <span>Interactive Bus Seat Matrix (বাস সিট ম্যাপ)</span>
                          </span>
                          <span className="font-mono text-[11px] text-white/50">
                            Driver Side: Right • Entry Door: Left
                          </span>
                        </div>

                        <div className="max-w-md mx-auto space-y-2 py-2">
                          {SEAT_LAYOUT.map((row, rIdx) => {
                            const isBackRow = row.length === 5;
                            return (
                              <div key={rIdx} className="flex items-center justify-between gap-2">
                                {/* Left Pair: A1, A2 */}
                                <div className="flex items-center gap-2">
                                  {row.slice(0, 2).map((seatId) => {
                                    const s = currentTrip.seats?.[seatId];
                                    const isBooked = s?.status === 'booked';
                                    const isReserved = s?.status === 'reserved';
                                    return (
                                      <div
                                        key={seatId}
                                        title={`${seatId}: ${isBooked ? `Booked by ${s?.name || 'Passenger'} (${s?.phone || ''})` : isReserved ? 'Reserved' : 'Available'}`}
                                        className={`w-12 h-11 rounded-xl flex flex-col items-center justify-center font-mono font-bold text-xs transition-all select-none shadow-sm ${
                                          isBooked
                                            ? 'bg-emerald-600 text-white border border-emerald-400/50 shadow-emerald-500/20'
                                            : isReserved
                                            ? 'bg-amber-600 text-white border border-amber-400/50 shadow-amber-500/20'
                                            : 'bg-[#18202C] text-white/70 border border-[#253244]'
                                        }`}
                                      >
                                        <span>{seatId}</span>
                                        <span className="text-[9px] font-sans opacity-80 scale-90">
                                          {isBooked ? '৳' + (s?.fee || '') : isReserved ? 'Hold' : 'Free'}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>

                                {/* Middle Aisle (or 5th seat in back row) */}
                                {isBackRow ? (
                                  <div
                                    key={row[4]}
                                    className={`w-12 h-11 rounded-xl flex flex-col items-center justify-center font-mono font-bold text-xs shadow-sm ${
                                      currentTrip.seats?.[row[4]]?.status === 'booked'
                                        ? 'bg-emerald-600 text-white border border-emerald-400/50'
                                        : 'bg-[#18202C] text-white/70 border border-[#253244]'
                                    }`}
                                  >
                                    <span>{row[4]}</span>
                                    <span className="text-[9px] font-sans opacity-80 scale-90">
                                      {currentTrip.seats?.[row[4]]?.status === 'booked' ? '৳' : 'Free'}
                                    </span>
                                  </div>
                                ) : (
                                  <div className="w-8 text-center text-[10px] font-mono text-white/30 tracking-widest">
                                    ||
                                  </div>
                                )}

                                {/* Right Pair: A3, A4 */}
                                <div className="flex items-center gap-2">
                                  {row.slice(2, 4).map((seatId) => {
                                    const s = currentTrip.seats?.[seatId];
                                    const isBooked = s?.status === 'booked';
                                    const isReserved = s?.status === 'reserved';
                                    return (
                                      <div
                                        key={seatId}
                                        title={`${seatId}: ${isBooked ? `Booked by ${s?.name || 'Passenger'} (${s?.phone || ''})` : isReserved ? 'Reserved' : 'Available'}`}
                                        className={`w-12 h-11 rounded-xl flex flex-col items-center justify-center font-mono font-bold text-xs transition-all select-none shadow-sm ${
                                          isBooked
                                            ? 'bg-emerald-600 text-white border border-emerald-400/50 shadow-emerald-500/20'
                                            : isReserved
                                            ? 'bg-amber-600 text-white border border-amber-400/50 shadow-amber-500/20'
                                            : 'bg-[#18202C] text-white/70 border border-[#253244]'
                                        }`}
                                      >
                                        <span>{seatId}</span>
                                        <span className="text-[9px] font-sans opacity-80 scale-90">
                                          {isBooked ? '৳' + (s?.fee || '') : isReserved ? 'Hold' : 'Free'}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Passenger Bookings Table for this Trip */}
                      <div className="space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <h5 className="text-xs font-bold text-white flex items-center gap-1.5">
                            <Ticket size={14} className="text-emerald-400" />
                            <span>Passenger Manifest &amp; Booking Details ({currentTripBookings.length} Bookings)</span>
                          </h5>

                          <div className="relative">
                            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/50" />
                            <input
                              type="text"
                              value={passengerSearchQuery}
                              onChange={(e) => setPassengerSearchQuery(e.target.value)}
                              placeholder="Search seat or passenger name..."
                              className="pl-8 pr-3 py-1.5 bg-[#141A23] border border-[#232D3B] rounded-xl text-xs text-white placeholder-white/40 focus:outline-none focus:border-amber-500"
                            />
                          </div>
                        </div>

                        {currentTripBookings.length === 0 ? (
                          <div className="py-8 text-center text-xs text-white/60 bg-[#121822] rounded-xl border border-[#1E2633]">
                            No passenger bookings found on this trip.
                          </div>
                        ) : (
                          <div className="overflow-x-auto rounded-xl border border-[#1E2633]">
                            <table className="w-full text-left text-xs border-collapse">
                              <thead>
                                <tr className="bg-[#141A23] border-b border-[#1E2633] text-white/70 font-semibold">
                                  <th className="p-3">Seat</th>
                                  <th className="p-3">Passenger Name</th>
                                  <th className="p-3">Phone Number</th>
                                  <th className="p-3">Fare / Payment</th>
                                  <th className="p-3">Boarding / Drop</th>
                                  <th className="p-3">Status</th>
                                  <th className="p-3">Notes</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[#1A222F] bg-[#0E141C]">
                                {currentTripBookings.map((b) => (
                                  <tr key={b.seatId} className="hover:bg-[#141A23]/50 transition-colors">
                                    <td className="p-3 font-mono font-bold text-amber-400">
                                      {b.seatId}
                                    </td>
                                    <td className="p-3 font-semibold text-white">
                                      {b.name || '—'}
                                    </td>
                                    <td className="p-3 font-mono text-white/80">
                                      {b.phone ? (
                                        <a href={`tel:${b.phone}`} className="hover:text-amber-400 hover:underline">
                                          {b.phone}
                                        </a>
                                      ) : (
                                        '—'
                                      )}
                                    </td>
                                    <td className="p-3 font-mono">
                                      <span className="font-bold text-white">{formatTaka(b.fee)}</span>
                                      <span className={`ml-1.5 text-[10px] uppercase px-1.5 py-0.2 rounded font-sans font-bold ${
                                        b.payment === 'paid' ? 'bg-emerald-500/20 text-emerald-400' : b.payment === 'advance' ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'
                                      }`}>
                                        {b.payment || 'paid'}
                                      </span>
                                    </td>
                                    <td className="p-3 text-white/70">
                                      <div className="truncate max-w-[150px]">
                                        {b.boarding || 'Counter'} → {b.drop || 'Dest'}
                                      </div>
                                    </td>
                                    <td className="p-3">
                                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                        b.status === 'booked' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                                      }`}>
                                        {b.status}
                                      </span>
                                    </td>
                                    <td className="p-3 text-white/50 text-[11px] truncate max-w-[120px]">
                                      {b.notes || '—'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* SUB-TAB 2: COUNTER & PRINT SETTINGS */}
              {activeSubTab === 'settings' && (
                <div className="bg-[#0E141C] border border-[#1E2633] rounded-2xl p-6 space-y-6">
                  <div className="flex items-center justify-between border-b border-[#1E2633] pb-4">
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <Sliders size={16} className="text-amber-400" />
                        <span>Agency Counter &amp; Printing Configurations</span>
                      </h4>
                      <p className="text-xs text-white/70">
                        Configured at Firestore document: <code className="text-amber-400 font-mono">users/{selectedUser.id}/settings/config</code>
                      </p>
                    </div>

                    <span className="text-xs font-mono px-2.5 py-1 rounded-xl bg-[#141A23] text-white/80 border border-[#232D3B]">
                      {userSettings ? 'Live Configured' : 'Using App Defaults'}
                    </span>
                  </div>

                  {loadingSettings ? (
                    <div className="py-12 text-center text-xs text-white/60">
                      <div className="w-5 h-5 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin mx-auto mb-2" />
                      Loading counter settings...
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Left: General Counter Brand Identity */}
                      <div className="space-y-4 bg-[#121822] p-5 rounded-2xl border border-[#1E2633]">
                        <h5 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                          <Building2 size={14} className="text-amber-400" />
                          <span>Brand &amp; Display Identity</span>
                        </h5>

                        <div className="space-y-3 text-xs">
                          <div>
                            <span className="text-white/60 block text-[11px]">Bus / Counter Display Name</span>
                            <strong className="text-white text-sm font-semibold block mt-0.5">
                              {userSettings?.busName || selectedUser.information?.agencyName || selectedUser.agencyName || 'ZH Travel'}
                            </strong>
                          </div>

                          <div>
                            <span className="text-white/60 block text-[11px]">Heading / Subtitle</span>
                            <strong className="text-white block mt-0.5">
                              {userSettings?.heading || 'Super Express Non-AC'}
                            </strong>
                          </div>

                          <div>
                            <span className="text-white/60 block text-[11px]">Active Route</span>
                            <strong className="text-white block mt-0.5">
                              {userSettings?.route || 'Dhaka — Chittagong — Cox\'s Bazar'}
                            </strong>
                          </div>

                          <div>
                            <span className="text-white/60 block text-[11px]">Theme Mode</span>
                            <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/20 text-amber-400 border border-amber-500/30">
                              {userSettings?.theme || 'dark'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Thermal Print & Ticket Format */}
                      <div className="space-y-4 bg-[#121822] p-5 rounded-2xl border border-[#1E2633]">
                        <h5 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                          <Printer size={14} className="text-emerald-400" />
                          <span>POS Thermal Ticket Settings</span>
                        </h5>

                        <div className="space-y-3 text-xs">
                          <div>
                            <span className="text-white/60 block text-[11px]">Thermal Paper Width</span>
                            <strong className="text-white font-mono block mt-0.5">
                              {userSettings?.printWidthMm ? `${userSettings.printWidthMm} mm` : '80 mm (Default POS)'}
                            </strong>
                          </div>

                          <div>
                            <span className="text-white/60 block text-[11px]">Ticket Header Notice</span>
                            <p className="text-white/90 font-mono text-[11px] bg-[#0E141C] p-2 rounded-xl border border-[#1E2633] mt-1">
                              {userSettings?.ticketHeader || 'Safe Journey With Us. Report 15 minutes before departure.'}
                            </p>
                          </div>

                          <div>
                            <span className="text-white/60 block text-[11px]">Ticket Footer / Policy</span>
                            <p className="text-white/90 font-mono text-[11px] bg-[#0E141C] p-2 rounded-xl border border-[#1E2633] mt-1">
                              {userSettings?.ticketFooter || 'Tickets once booked are non-refundable. Counter Copy.'}
                            </p>
                          </div>

                          <div>
                            <span className="text-white/60 block text-[11px]">Developer Credit Line</span>
                            <p className="text-white/70 font-mono text-[11px] mt-0.5">
                              {userSettings?.devLine || 'System Managed by ZH Tech'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* SUB-TAB 3: ALL PASSENGER ROSTER ACROSS ALL TRIPS */}
              {activeSubTab === 'passengers' && (
                <div className="bg-[#0E141C] border border-[#1E2633] rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-[#1E2633] pb-3">
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <Users size={16} className="text-amber-400" />
                      <span>Aggregated Passenger Bookings ({userMetrics.totalBookedSeats} Passengers)</span>
                    </h4>
                  </div>

                  {userMetrics.totalBookedSeats === 0 ? (
                    <div className="py-12 text-center text-xs text-white/60">
                      No passengers have been booked across any trips for this user.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-[#1E2633]">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-[#141A23] border-b border-[#1E2633] text-white/70 font-semibold">
                            <th className="p-3">Trip / Route</th>
                            <th className="p-3">Date</th>
                            <th className="p-3">Seat</th>
                            <th className="p-3">Passenger</th>
                            <th className="p-3">Phone</th>
                            <th className="p-3">Fare</th>
                            <th className="p-3">Payment</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#1A222F] bg-[#0E141C]">
                          {(Object.values(userTrips) as Trip[]).flatMap((t) =>
                            ALL_SEAT_IDS.map((seatId) => {
                              const s = t.seats?.[seatId];
                              if (!s || (s.status !== 'booked' && s.status !== 'reserved')) return null;
                              return (
                                <tr key={`${t.id}_${seatId}`} className="hover:bg-[#141A23]/50 transition-colors">
                                  <td className="p-3 font-semibold text-white truncate max-w-[150px]">
                                    {t.route}
                                  </td>
                                  <td className="p-3 font-mono text-white/70">
                                    {formatDate(t.date)}
                                  </td>
                                  <td className="p-3 font-mono font-bold text-amber-400">
                                    {seatId}
                                  </td>
                                  <td className="p-3 text-white">
                                    {s.name || '—'}
                                  </td>
                                  <td className="p-3 font-mono text-white/80">
                                    {s.phone ? (
                                      <a href={`tel:${s.phone}`} className="hover:text-amber-400 hover:underline">
                                        {s.phone}
                                      </a>
                                    ) : (
                                      '—'
                                    )}
                                  </td>
                                  <td className="p-3 font-mono font-bold text-white">
                                    {formatTaka(s.fee)}
                                  </td>
                                  <td className="p-3">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                      s.payment === 'paid' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                                    }`}>
                                      {s.payment || 'paid'}
                                    </span>
                                  </td>
                                </tr>
                              );
                            }).filter(Boolean)
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* SUB-TAB 4: RAW FIRESTORE JSON INSPECTOR */}
              {activeSubTab === 'raw_json' && (
                <div className="bg-[#0E141C] border border-[#1E2633] rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-[#1E2633] pb-3">
                    <div className="space-y-0.5">
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <FileSpreadsheet size={16} className="text-amber-400" />
                        <span>Complete User Document &amp; Subcollections Tree</span>
                      </h4>
                      <p className="text-xs text-white/60">
                        Raw JSON payload compiled from Firestore <code className="text-amber-400">/users/{selectedUser.id}</code>
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleCopyJSON}
                        className="px-3 py-1.5 rounded-xl bg-[#141A23] hover:bg-[#1A222F] text-white border border-[#232D3B] text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        {copiedJson ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                        <span>{copiedJson ? 'Copied' : 'Copy All'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleDownloadUserJSON}
                        className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                      >
                        <Download size={14} />
                        <span>Download JSON</span>
                      </button>
                    </div>
                  </div>

                  <div className="max-h-[500px] overflow-y-auto bg-[#080B10] p-4 rounded-xl border border-[#1E2633]">
                    <pre className="text-xs font-mono text-emerald-400/90 whitespace-pre-wrap break-all leading-relaxed">
                      {JSON.stringify(
                        {
                          userProfile: selectedUser,
                          settings: userSettings,
                          trips: userTrips,
                          metrics: userMetrics,
                        },
                        null,
                        2
                      )}
                    </pre>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
