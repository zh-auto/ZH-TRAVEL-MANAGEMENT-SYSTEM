/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SeatInfo, Trip } from './types';

export const SEAT_LAYOUT = [
  ['A1', 'A2', 'A3', 'A4'],
  ['B1', 'B2', 'B3', 'B4'],
  ['C1', 'C2', 'C3', 'C4'],
  ['D1', 'D2', 'D3', 'D4'],
  ['E1', 'E2', 'E3', 'E4'],
  ['F1', 'F2', 'F3', 'F4'],
  ['G1', 'G2', 'G3', 'G4'],
  ['H1', 'H2', 'H3', 'H4'],
  ['I1', 'I2', 'I3', 'I4'],
  ['J1', 'J2', 'J3', 'J4'],
  ['K1', 'K2', 'K3', 'K4', 'K5'],
];

export const ALL_SEAT_IDS = SEAT_LAYOUT.flat();

export function uid(prefix: string): string {
  return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function emptySeats(): Record<string, SeatInfo> {
  const obj: Record<string, SeatInfo> = {};
  ALL_SEAT_IDS.forEach(id => {
    obj[id] = { status: 'available' };
  });
  return obj;
}

export function formatTaka(n: number | string | undefined): string {
  const num = Number(n) || 0;
  return '৳' + num.toLocaleString('en-US');
}

export function formatDate(dStr: string | undefined): string {
  if (!dStr) return '—';
  const d = new Date(dStr + 'T00:00:00');
  if (isNaN(d.getTime())) return dStr;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateShort(dStr: string | undefined): string {
  if (!dStr) return '—';
  const d = new Date(dStr + 'T00:00:00');
  if (isNaN(d.getTime())) return dStr;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

export function capitalize(s: string | undefined): string {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function seatStats(trip: Trip) {
  const seats = trip.seats;
  let booked = 0, reserved = 0, cancelled = 0, available = 0;
  let paidCount = 0, advCount = 0, dueCount = 0;
  let collected = 0, due = 0;

  ALL_SEAT_IDS.forEach(id => {
    const s = seats[id] || { status: 'available' };
    if (s.status === 'booked') booked++;
    else if (s.status === 'reserved') reserved++;
    else if (s.status === 'cancelled') cancelled++;
    else available++;

    if (s.status === 'booked' || s.status === 'reserved') {
      const amt = Number(s.fee) || 0;
      if (s.payment === 'paid') {
        paidCount++;
        collected += amt;
      } else if (s.payment === 'advance') {
        advCount++;
        collected += amt;
      } else if (s.payment === 'due') {
        dueCount++;
        due += amt;
      }
    }
  });

  return {
    booked,
    reserved,
    cancelled,
    available,
    total: ALL_SEAT_IDS.length,
    paidCount,
    advCount,
    dueCount,
    collected,
    due,
  };
}
