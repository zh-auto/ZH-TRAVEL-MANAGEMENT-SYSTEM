/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { SeatInfo, Trip } from '../types';

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  seatId: string | null;
  seatInfo: SeatInfo | undefined;
  onSaveBooking: (seatId: string, info: SeatInfo) => void;
  onCancelBooking: (seatId: string) => void;
  onPrintTicket: (seatId: string) => void;
}

export function BookingModal({
  isOpen,
  onClose,
  seatId,
  seatInfo,
  onSaveBooking,
  onCancelBooking,
  onPrintTicket,
}: BookingModalProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [fee, setFee] = useState('');
  const [boarding, setBoarding] = useState('');
  const [drop, setDrop] = useState('');
  const [payment, setPayment] = useState<'paid' | 'advance' | 'due'>('paid');
  const [status, setStatus] = useState<'booked' | 'reserved'>('booked');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (isOpen && seatId) {
      setName(seatInfo?.name || '');
      setPhone(seatInfo?.phone || '');
      setFee(seatInfo?.fee !== undefined ? String(seatInfo.fee) : '');
      setBoarding(seatInfo?.boarding || '');
      setDrop(seatInfo?.drop || '');
      setPayment(seatInfo?.payment || 'paid');
      setStatus(seatInfo?.status === 'reserved' ? 'reserved' : 'booked');
      setNotes(seatInfo?.notes || '');
    }
  }, [isOpen, seatId, seatInfo]);

  if (!isOpen || !seatId) return null;

  const isOccupied = seatInfo && (seatInfo.status === 'booked' || seatInfo.status === 'reserved');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || fee === '') return;

    onSaveBooking(seatId, {
      status,
      payment,
      name: name.trim(),
      phone: phone.trim(),
      fee: Number(fee) || 0,
      boarding: boarding.trim(),
      drop: drop.trim(),
      notes: notes.trim(),
      updatedAt: Date.now(),
    });
  };

  return (
    <>
      <div className="modal-backdrop open" onClick={onClose} />
      <div className="modal open" id="bookingModal">
        <div className="modal-head">
          <h2 id="bookingModalTitle">
            {isOccupied ? `Edit Seat ${seatId}` : `Book Seat ${seatId}`}
          </h2>
          <button className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">
          <form id="bookingForm" onSubmit={handleSubmit}>
            <div className="form-group">
              <label>
                Passenger Name <span className="req">*</span>
              </label>
              <input
                type="text"
                className="text-input"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                placeholder="Full name"
                autoFocus
              />
            </div>
            <div className="form-row two-col">
              <div className="form-group">
                <label>
                  Phone Number <span className="req">*</span>
                </label>
                <input
                  type="tel"
                  className="text-input"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  required
                  placeholder="01XXXXXXXXX"
                />
              </div>
              <div className="form-group">
                <label>
                  Fee Amount (৳) <span className="req">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  className="text-input"
                  value={fee}
                  onChange={e => setFee(e.target.value)}
                  required
                  placeholder="0"
                />
              </div>
            </div>
            <div className="form-row two-col">
              <div className="form-group">
                <label>Boarding Point</label>
                <input
                  type="text"
                  className="text-input"
                  value={boarding}
                  onChange={e => setBoarding(e.target.value)}
                  placeholder="e.g. Saidabad"
                />
              </div>
              <div className="form-group">
                <label>Drop Point</label>
                <input
                  type="text"
                  className="text-input"
                  value={drop}
                  onChange={e => setDrop(e.target.value)}
                  placeholder="e.g. Maijdee"
                />
              </div>
            </div>
            <div className="form-group">
              <label>Payment Status</label>
              <div className="seg-control" id="paymentSeg">
                {(['paid', 'advance', 'due'] as const).map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPayment(p)}
                    className={`seg-btn ${payment === p ? 'active' : ''}`}
                  >
                    {p === 'paid' ? 'Paid' : p === 'advance' ? 'Advance' : 'Due'}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label>Seat Status</label>
              <div className="seg-control" id="statusSeg">
                {(['booked', 'reserved'] as const).map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    className={`seg-btn ${status === s ? 'active' : ''}`}
                  >
                    {s === 'booked' ? 'Booked' : 'Reserved'}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label>Notes</label>
              <textarea
                className="text-input"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                placeholder="Optional notes…"
              />
            </div>
          </form>
        </div>
        <div className="modal-foot">
          {isOccupied && (
            <button
              onClick={() => onCancelBooking(seatId)}
              className="btn btn-danger-ghost"
              id="cancelSeatBtn"
            >
              Cancel Booking
            </button>
          )}
          <div className="modal-foot-right">
            {isOccupied && (
              <button
                onClick={() => onPrintTicket(seatId)}
                className="btn btn-ghost"
                id="printTicketBtn"
              >
                Print Ticket
              </button>
            )}
            <button type="submit" form="bookingForm" className="btn btn-primary" id="saveBookingBtn">
              {isOccupied ? 'Update Booking' : 'Save Booking'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

interface TripModalProps {
  isOpen: boolean;
  onClose: () => void;
  tripId: string | null;
  tripInfo: Trip | undefined;
  defaultBusName: string;
  onSaveTrip: (
    id: string | null,
    details: { route: string; date: string; time: string; busName: string }
  ) => void;
  onDeleteTrip: (id: string) => void;
}

export function TripModal({
  isOpen,
  onClose,
  tripId,
  tripInfo,
  defaultBusName,
  onSaveTrip,
  onDeleteTrip,
}: TripModalProps) {
  const [route, setRoute] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [busName, setBusName] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (tripId && tripInfo) {
        setRoute(tripInfo.route);
        setDate(tripInfo.date);
        setTime(tripInfo.time || '');
        setBusName(tripInfo.busName || '');
      } else {
        setRoute('');
        setDate(new Date().toISOString().slice(0, 10));
        setTime('');
        setBusName(defaultBusName || 'Green Express');
      }
    }
  }, [isOpen, tripId, tripInfo, defaultBusName]);

  if (!isOpen) return null;

  const isEdit = !!tripId;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!route.trim() || !date) return;

    onSaveTrip(tripId, {
      route: route.trim(),
      date,
      time,
      busName: busName.trim(),
    });
  };

  return (
    <>
      <div className="modal-backdrop open" onClick={onClose} />
      <div className="modal modal-sm open" id="tripModal">
        <div className="modal-head">
          <h2>{isEdit ? 'Edit Trip' : 'New Trip'}</h2>
          <button className="icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">
          <form id="tripForm" onSubmit={handleSubmit}>
            <div className="form-group">
              <label>
                Route <span className="req">*</span>
              </label>
              <input
                type="text"
                className="text-input"
                value={route}
                onChange={e => setRoute(e.target.value)}
                required
                placeholder="e.g. Dhaka → Khulna"
                autoFocus
              />
            </div>
            <div className="form-row two-col">
              <div className="form-group">
                <label>
                  Date <span className="req">*</span>
                </label>
                <input
                  type="date"
                  className="text-input"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>Time</label>
                <input
                  type="time"
                  className="text-input"
                  value={time}
                  onChange={e => setTime(e.target.value)}
                />
              </div>
            </div>
            <div className="form-group">
              <label>Bus Name</label>
              <input
                type="text"
                className="text-input"
                value={busName}
                onChange={e => setBusName(e.target.value)}
                placeholder="e.g. Green Express"
              />
            </div>
          </form>
        </div>
        <div className="modal-foot">
          {isEdit && (
            <button
              onClick={() => onDeleteTrip(tripId)}
              className="btn btn-danger-ghost"
              id="deleteTripBtn"
            >
              Delete Trip
            </button>
          )}
          <div className="modal-foot-right">
            <button type="submit" form="tripForm" className="btn btn-primary" id="saveTripBtn">
              Save Trip
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  text: string;
  okLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({ isOpen, title, text, okLabel, onConfirm, onCancel }: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <>
      <div className="modal-backdrop open" onClick={onCancel} />
      <div className="modal modal-xs open" id="confirmModal">
        <div className="modal-body confirm-body">
          <div className="confirm-icon" id="confirmIcon">
            !
          </div>
          <h3 id="confirmTitle">{title}</h3>
          <p id="confirmText">{text}</p>
        </div>
        <div className="modal-foot confirm-foot">
          <button className="btn btn-ghost" onClick={onCancel} id="confirmCancelBtn">
            Cancel
          </button>
          <button className="btn btn-danger" onClick={onConfirm} id="confirmOkBtn">
            {okLabel || 'Confirm'}
          </button>
        </div>
      </div>
    </>
  );
}
