import React from 'react';
import {
  PROFILE_STATUS_TONE_CLASS,
  type ResolvedProfileStatus,
} from '../../lib/profileStatus';

type ProfileStatusBadgesProps = {
  status: ResolvedProfileStatus;
  showHint?: boolean;
  className?: string;
};

export function ProfileStatusBadges({
  status,
  showHint = false,
  className = '',
}: ProfileStatusBadgesProps) {
  return (
    <div className={className}>
      <div className="flex flex-wrap gap-1.5 mt-2">
        {status.pills.map((pill) => (
          <span
            key={pill.key}
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider border ${PROFILE_STATUS_TONE_CLASS[pill.tone]}`}
          >
            {pill.label}
          </span>
        ))}
      </div>
      {showHint && status.hint ? (
        <p className="text-[10.5px] text-[#6B7280] font-semibold mt-1.5 leading-snug">{status.hint}</p>
      ) : null}
    </div>
  );
}

export default ProfileStatusBadges;
