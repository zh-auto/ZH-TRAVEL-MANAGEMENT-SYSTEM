/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { addDoc, collection, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from './firebase';

export interface LogActivityParams {
  type: 'REGISTRATION' | 'LOGIN' | 'ACCOUNT_STATUS_CHANGE' | 'AGENCY_CODE_CHANGE' | 'IMPORTANT_ACTION' | 'DEVELOPER_CONFIG_CHANGE' | string;
  action: string;
  targetAgency?: string;
  targetEmail?: string;
  targetUserId?: string;
  performedBy: string;
  performedByRole?: string;
  details: string;
  metadata?: Record<string, any>;
}

/**
 * Persists an activity log to Firestore and updates user's lastActivity timestamp.
 */
export async function recordActivityLog(params: LogActivityParams): Promise<void> {
  try {
    const payload = {
      type: params.type || 'IMPORTANT_ACTION',
      action: params.action,
      targetAgency: params.targetAgency || 'General',
      targetEmail: params.targetEmail || '',
      targetUserId: params.targetUserId || '',
      performedBy: params.performedBy || 'System',
      performedByRole: params.performedByRole || 'user',
      details: params.details || '',
      metadata: params.metadata || {},
      timestamp: serverTimestamp(),
    };

    // 1. Write to activity_logs collection
    await addDoc(collection(db, 'activity_logs'), payload);

    // 2. If targetUserId or current user ID is provided, touch lastActivity
    const uidToTouch = params.targetUserId;
    if (uidToTouch) {
      const userRef = doc(db, 'users', uidToTouch);
      setDoc(userRef, { lastActivity: serverTimestamp() }, { merge: true }).catch(() => {});
    }
  } catch (err) {
    console.warn('Activity logging notice:', err);
  }
}
