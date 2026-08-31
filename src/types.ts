/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface UserInformation {
  agencyName: string;
  adminName: string;
  email: string;
  agencyLocation: string;
  registeredAt?: any;
}

export interface UserManagement {
  agencyCode: string;
  accountStatus: boolean | 'Active' | 'Suspended' | 'Pending' | string;
  userName: string;
  activatedAt?: any;
  lastLogin?: any;
  expiresAt?: any;
}

export interface AuthUser {
  uid: string;
  email: string;
  displayName: string;
  name?: string;
  loginId?: string; // Agency Code or developer Login ID
  photoURL?: string | null;
  role?: 'admin' | 'member' | 'guest' | 'agency' | 'developer';
  isApproved: boolean;
  memberIdAssigned: boolean;
  createdAt?: any;
  agencyName?: string;
  agencyLocation?: string;
  agencyCode?: string;
  status?: string;
  accountStatus?: boolean;
  information?: UserInformation;
  management?: UserManagement;
  activeSessionId?: string;
  activeDevSessionId?: string;
}

export interface SeatInfo {
  status: 'available' | 'booked' | 'reserved' | 'cancelled';
  payment?: 'paid' | 'advance' | 'due';
  name?: string;
  phone?: string;
  fee?: number;
  boarding?: string;
  drop?: string;
  notes?: string;
  updatedAt?: number;
}

export interface Trip {
  id: string;
  tripName?: string;
  route: string;
  date: string;
  time: string;
  busName: string;
  agencyName?: string;
  seats: Record<string, SeatInfo>;
  ownerUid?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface Settings {
  busName: string;
  heading: string;
  route: string;
  date: string;
  time: string;
  theme: 'dark' | 'light';
  logo: string | null;
  devLine: string;
  ticketHeader: string;
  ticketFooter: string;
  printWidthMm: number;
}

export interface AppState {
  settings: Settings;
  activeTripId: string;
  trips: Record<string, Trip>;
}
