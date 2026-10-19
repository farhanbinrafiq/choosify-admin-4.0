import React, { useState } from 'react';
import { Mail, MessageSquare, Phone } from 'lucide-react';
import { ProfileMessagePopup } from '../../messaging/ProfileMessagePopup';

/**
 * Identity-card contact row shared by the Consumer / Seller / Creator profiles:
 * Call (tel:), Message (popup → sends into the real Messages conversation with
 * this user, then opens it) and Email (mailto:). The phone number and email
 * stay visible as text next to the icons.
 */
const iconBtn: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: '50%',
  border: '1px solid #E8EDF2',
  background: '#fff',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#2563EB',
  cursor: 'pointer',
  textDecoration: 'none',
  flexShrink: 0,
};
const disabledBtn: React.CSSProperties = { ...iconBtn, color: '#CBD5E1', cursor: 'not-allowed' };
const line: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700, color: '#2563EB', textDecoration: 'none', overflowWrap: 'anywhere' };

export function ProfileContactActions({
  targetUserId,
  targetName,
  email,
  phone,
  phoneTitle,
}: {
  targetUserId: string;
  targetName: string;
  email?: string | null;
  phone?: string | null;
  phoneTitle?: string;
}) {
  const [open, setOpen] = useState(false);
  const tel = phone ? phone.replace(/[^+0-9]/g, '') : '';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }} data-testid="profile-contact">
      <div style={{ display: 'flex', gap: 8 }}>
        {tel ? (
          <a href={`tel:${tel}`} style={iconBtn} title={phoneTitle || `Call ${phone}`} aria-label={`Call ${phone}`} data-testid="profile-call-icon">
            <Phone size={14} />
          </a>
        ) : (
          <span style={disabledBtn} title="No phone number on file" aria-label="No phone number on file">
            <Phone size={14} />
          </span>
        )}
        <button
          type="button"
          style={targetUserId ? iconBtn : disabledBtn}
          disabled={!targetUserId}
          onClick={() => setOpen(true)}
          title={`Message ${targetName}`}
          aria-label={`Message ${targetName}`}
          data-testid="profile-message-icon"
        >
          <MessageSquare size={14} />
        </button>
        {email ? (
          <a href={`mailto:${email}`} style={iconBtn} title={`Email ${email}`} aria-label={`Email ${email}`}>
            <Mail size={14} />
          </a>
        ) : null}
      </div>
      {email ? (
        <a href={`mailto:${email}`} style={line}>
          <Mail size={12} /> {email}
        </a>
      ) : null}
      {tel ? (
        <a href={`tel:${tel}`} style={line} title={phoneTitle} data-testid="profile-call">
          <Phone size={12} /> {phone}
        </a>
      ) : (
        <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Phone size={12} /> No phone number on file
        </span>
      )}
      {open && targetUserId ? <ProfileMessagePopup targetUserId={targetUserId} targetName={targetName} onClose={() => setOpen(false)} /> : null}
    </div>
  );
}
