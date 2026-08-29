/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Printer, Edit, Check } from 'lucide-react';
import { Trip } from '../types';
import { ALL_SEAT_IDS, formatTaka, capitalize } from '../utils';

interface PassengersViewProps {
  trip: Trip;
  onEditSeat: (seatId: string) => void;
  onPrintSeat: (seatId: string) => void;
  onPrintBulkSeats: (seatIds: string[]) => void;
  selectedPassengerKeys: Set<string>;
  setSelectedPassengerKeys: React.Dispatch<React.SetStateAction<Set<string>>>;
}

export default function PassengersView({
  trip,
  onEditSeat,
  onPrintSeat,
  onPrintBulkSeats,
  selectedPassengerKeys,
  setSelectedPassengerKeys,
}: PassengersViewProps) {
  const [filterText, setFilterText] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');

  const passengerKey = (tripId: string, seatId: string) => `${tripId}:${seatId}`;

  // Get active passengers
  let rows = ALL_SEAT_IDS
    .map(id => {
      const s = trip.seats[id];
      if (s && s.status !== 'available') {
        return {
          id,
          name: s.name || '',
          phone: s.phone || '',
          boarding: s.boarding || '',
          drop: s.drop || '',
          status: s.status,
          payment: s.payment || 'due',
          fee: s.fee || 0,
          notes: s.notes || '',
          updatedAt: s.updatedAt || 0,
        };
      }
      return null;
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);

  // Apply filters
  if (statusFilter !== 'all') {
    rows = rows.filter(s => s.status === statusFilter);
  }
  if (paymentFilter !== 'all') {
    rows = rows.filter(s => s.payment === paymentFilter);
  }
  if (filterText.trim()) {
    const cleanQ = filterText.toLowerCase().trim();
    rows = rows.filter(
      s =>
        (s.name || '').toLowerCase().includes(cleanQ) ||
        (s.phone || '').toLowerCase().includes(cleanQ) ||
        s.id.toLowerCase().includes(cleanQ)
    );
  }

  // Sort by seat label naturally (A1, A2, B1, etc.)
  rows.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));

  const activeSelectedKeys = rows.filter(r => selectedPassengerKeys.has(passengerKey(trip.id, r.id)));
  const isAllChecked = rows.length > 0 && activeSelectedKeys.length === rows.length;
  const isIndeterminate = rows.length > 0 && activeSelectedKeys.length > 0 && activeSelectedKeys.length < rows.length;

  const handleHeadCheckChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newKeys = new Set(selectedPassengerKeys);
    rows.forEach(r => {
      const key = passengerKey(trip.id, r.id);
      if (e.target.checked) {
        newKeys.add(key);
      } else {
        newKeys.delete(key);
      }
    });
    setSelectedPassengerKeys(newKeys);
  };

  const handleRowCheckChange = (seatId: string, checked: boolean) => {
    const newKeys = new Set(selectedPassengerKeys);
    const key = passengerKey(trip.id, seatId);
    if (checked) {
      newKeys.add(key);
    } else {
      newKeys.delete(key);
    }
    setSelectedPassengerKeys(newKeys);
  };

  const handleClearBulk = () => {
    const newKeys = new Set(selectedPassengerKeys);
    rows.forEach(r => {
      newKeys.delete(passengerKey(trip.id, r.id));
    });
    setSelectedPassengerKeys(newKeys);
  };

  const handlePrintBulk = () => {
    const selectedSeatIds = activeSelectedKeys.map(r => r.id);
    if (selectedSeatIds.length === 0) return;
    onPrintBulkSeats(selectedSeatIds);
  };

  const handleExportCsv = () => {
    const headers = ['Seat', 'Name', 'Phone', 'Boarding', 'Drop', 'Status', 'Payment', 'Amount', 'Notes'];
    const csvRows = [headers];

    ALL_SEAT_IDS.forEach(id => {
      const s = trip.seats[id];
      if (!s || s.status === 'available') return;
      csvRows.push([
        id,
        s.name || '',
        s.phone || '',
        s.boarding || '',
        s.drop || '',
        s.status,
        s.payment || '',
        String(s.fee || 0),
        (s.notes || '').replace(/[\r\n]+/g, ' '),
      ]);
    });

    const csvContent = csvRows
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `passengers-${trip.route.replace(/[^a-z0-9]+/gi, '-')}-${trip.date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="view" id="view-passengers">
      <div className="view-head">
        <div>
          <h1>Passengers</h1>
          <p className="view-sub">All bookings for the active trip</p>
        </div>
        <div className="view-head-actions">
          <button onClick={handleExportCsv} className="btn btn-ghost" id="exportCsvBtn">
            Export CSV
          </button>
        </div>
      </div>

      <div className="filter-row">
        <input
          type="text"
          className="text-input"
          id="passengerFilter"
          placeholder="Filter by name, phone or seat…"
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
        />
        <select
          className="select-input"
          id="statusFilter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All Statuses</option>
          <option value="booked">Booked</option>
          <option value="reserved">Reserved</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select
          className="select-input"
          id="paymentFilter"
          value={paymentFilter}
          onChange={(e) => setPaymentFilter(e.target.value)}
        >
          <option value="all">All Payments</option>
          <option value="paid">Paid</option>
          <option value="advance">Advance</option>
          <option value="due">Due</option>
        </select>
      </div>

      <div className={`bulk-bar ${activeSelectedKeys.length > 0 ? 'show' : ''}`} id="bulkBar">
        <span className="bulk-bar-count" id="bulkBarCount">
          {activeSelectedKeys.length} selected
        </span>
        <div className="bulk-bar-actions">
          <button onClick={handleClearBulk} className="btn btn-ghost small" id="bulkClearBtn">
            Clear
          </button>
          <button onClick={handlePrintBulk} className="btn btn-primary small" id="bulkPrintBtn">
            <Printer size={14} />
            Print Selected
          </button>
        </div>
      </div>

      <div className="panel">
        <div className="table-wrap">
          <table className="data-table" id="passengerTable">
            <thead>
              <tr>
                <th className="td-check">
                  <input
                    type="checkbox"
                    className="head-check"
                    id="passengerHeadCheck"
                    checked={isAllChecked}
                    ref={input => {
                      if (input) input.indeterminate = isIndeterminate;
                    }}
                    onChange={handleHeadCheckChange}
                  />
                </th>
                <th>Seat</th>
                <th>Name</th>
                <th>Phone</th>
                <th>Boarding</th>
                <th>Drop</th>
                <th>Status</th>
                <th>Payment</th>
                <th>Amount</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(s => {
                const isChecked = selectedPassengerKeys.has(passengerKey(trip.id, s.id));
                return (
                  <tr key={s.id} onClick={() => onEditSeat(s.id)}>
                    <td className="td-check" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="row-check"
                        checked={isChecked}
                        onChange={(e) => handleRowCheckChange(s.id, e.target.checked)}
                      />
                    </td>
                    <td className="td-seat">{s.id}</td>
                    <td>{s.name || '—'}</td>
                    <td>{s.phone || '—'}</td>
                    <td>{s.boarding || '—'}</td>
                    <td>{s.drop || '—'}</td>
                    <td>
                      <span className={`status-tag ${s.status}`}>{capitalize(s.status)}</span>
                    </td>
                    <td>
                      <span className={`status-tag ${s.payment || 'due'}`}>
                        {capitalize(s.payment || 'due')}
                      </span>
                    </td>
                    <td className="td-amt">{formatTaka(s.fee)}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="row-actions">
                        <button
                          onClick={() => onEditSeat(s.id)}
                          className="row-action-btn"
                          title="Edit"
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          onClick={() => onPrintSeat(s.id)}
                          className="row-action-btn"
                          title="Print"
                        >
                          <Printer size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length === 0 && (
            <div className="empty-state" id="passengerEmpty">
              <p>No matching passengers</p>
              <span>Try adjusting filters, or book a new seat from the Seat Map.</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
