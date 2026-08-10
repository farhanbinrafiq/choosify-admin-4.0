import React, { useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

type PasswordInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'onChange'
> & {
  value: string;
  onChange: (value: string) => void;
  /** Extra classes for the outer wrapper (bordered container). */
  wrapperClassName?: string;
  /** Extra classes for the input element. */
  inputClassName?: string;
  /** Optional leading icon (e.g. Lock). */
  leadingIcon?: React.ReactNode;
  /** Accessible name for the show/hide control. */
  toggleLabel?: string;
};

/**
 * Password field with show / hide eye toggle.
 * Use anywhere users type a password or secret token.
 */
export function PasswordInput({
  value,
  onChange,
  wrapperClassName = '',
  inputClassName = '',
  leadingIcon,
  toggleLabel = 'Show password',
  className,
  id,
  disabled,
  ...rest
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const autoId = useId();
  const inputId = id || autoId;
  const hideLabel = 'Hide password';

  return (
    <div
      className={
        wrapperClassName ||
        `flex items-center gap-2 w-full rounded-lg border border-[#E5E7EB] bg-white px-3.5 ${
          leadingIcon ? '' : ''
        } ${className || ''}`.trim()
      }
    >
      {leadingIcon ? <span className="shrink-0 text-[#9CA3AF]">{leadingIcon}</span> : null}
      <input
        {...rest}
        id={inputId}
        type={visible ? 'text' : 'password'}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={
          inputClassName ||
          'flex-1 min-w-0 bg-transparent border-0 outline-none text-[13px] text-[#1A1A2E] placeholder:text-[#9AA0AC] py-2.5'
        }
      />
      <button
        type="button"
        tabIndex={0}
        disabled={disabled}
        aria-label={visible ? hideLabel : toggleLabel}
        aria-pressed={visible}
        title={visible ? hideLabel : toggleLabel}
        onClick={() => setVisible((v) => !v)}
        className="shrink-0 p-1 rounded-md text-[#9CA3AF] hover:text-[#374151] hover:bg-black/5 transition-colors disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-[#EF3C23]/40"
      >
        {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

export default PasswordInput;
