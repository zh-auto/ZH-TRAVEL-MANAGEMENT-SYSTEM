/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface FirestoreUserData {
  id: string;
  agencyName?: string;
  adminName?: string;
  email?: string;
  agencyLocation?: string;
  agencyCode?: string;
  loginId?: string;
  memberId?: string;
  role?: string;
  status?: string;
  accountStatus?: boolean;
  isApproved?: boolean;
  createdAt?: any;
  lastLogin?: any;
  lastActivity?: any;
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

export interface AgencyLicense {
  id: string;
  code: string;
  status: 'active' | 'deactive';
  assignedUserId?: string | null;
  assignedAgencyName?: string | null;
  assignedEmail?: string | null;
  assignedAt?: any;
  createdAt?: any;
  notes?: string;
}

export interface AuditLog {
  id: string;
  type?: 'REGISTRATION' | 'LOGIN' | 'ACCOUNT_STATUS_CHANGE' | 'AGENCY_CODE_CHANGE' | 'IMPORTANT_ACTION' | 'DEVELOPER_CONFIG_CHANGE' | string;
  action: string;
  targetAgency?: string;
  targetEmail?: string;
  targetUserId?: string;
  performedBy: string;
  performedByRole?: string;
  details: string;
  metadata?: Record<string, any>;
  timestamp: any;
}

export interface DeveloperNotification {
  id: string;
  type: 'NEW_REGISTRATION' | 'AGENCY_CODE_UPDATE' | 'ACCOUNT_ALERT' | string;
  title: string;
  agencyName: string;
  adminName: string;
  email: string;
  agencyLocation?: string;
  userId: string;
  accountStatus: string | boolean;
  agencyCodeAssigned: boolean;
  agencyCode?: string;
  registeredAt?: any;
  createdAt: any;
  read: boolean;
  readAt?: any;
}

export interface SystemConfig {
  developerEmail: string;
  developerCode: string;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  allowNewRegistrations: boolean;
  defaultCodePrefix: string;
  systemNotice: string;
  showNotice: boolean;
  sessionTimeoutMinutes: number;
  appLogo?: string;
  updatedAt?: any;
  updatedBy?: string;
}
