import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Mail, MailCheck } from 'lucide-react';
import { AdminAuthCard, AdminAuthInput, AdminAuthButton } from '../components/auth/AdminAuthCard';

/**
 * Dashboard (Admin / Partner) Forgot Password. Posts to the SAME canonical
 * endpoint as the consumer flow — the backend picks the correct reset surface
 * from the account's role, so a dashboard account's link comes back to
 * dashboard.choosify.bd. No social login here.
 */
export default function AdminForgotPasswordPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState(params.get('email')?.trim() || '');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const target = email.trim();
    if (!target || !target.includes('@')) {
      setError('Enter your account email address.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/auth/password-reset-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: target }),
      });
      // Generic on purpose — the API returns the same body regardless of
      // whether the account exists. Only a malformed request 400s.
      if (res.status === 400) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error || 'Enter a valid email address.');
        return;
      }
      setSent(true);
    } catch {
      setError('Unable to submit the request. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <AdminAuthCard
        title="Check your email"
        intro={`If a dashboard account exists for ${email}, we've sent a password reset link.`}
        footer={
          <button type="button" onClick={() => navigate('/login')} className="font-bold text-[#FF5B00]">
            Back to sign in
          </button>
        }
      >
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#FFF3EA]">
            <MailCheck className="h-7 w-7 text-[#FF5B00]" />
          </div>
          <p className="text-[12.5px] leading-relaxed text-[#4B5563]">
            The link expires in <span className="font-bold text-[#111827]">1 hour</span> and can be used once. Check
            your spam folder if it doesn't arrive.
          </p>
          <button
            type="button"
            onClick={() => setSent(false)}
            className="mt-4 text-[11px] font-bold text-[#FF5B00] hover:underline"
          >
            Use a different email
          </button>
        </div>
      </AdminAuthCard>
    );
  }

  return (
    <AdminAuthCard
      title="Reset your password"
      intro="Enter your dashboard account email and we'll send a secure reset link."
      footer={
        <button type="button" onClick={() => navigate('/login')} className="font-bold text-[#FF5B00]">
          Back to sign in
        </button>
      }
    >
      <form onSubmit={handleSubmit}>
        <AdminAuthInput
          id="email"
          label="EMAIL ADDRESS"
          type="email"
          required
          autoFocus
          icon={Mail}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@choosify.com.bd"
        />
        {error ? (
          <div className="mb-[18px] rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-[12.5px] text-red-700">
            {error}
          </div>
        ) : null}
        <AdminAuthButton type="submit" loading={submitting}>
          {submitting ? 'Sending…' : 'Send reset link'}
          {!submitting && <ArrowRight className="h-4 w-4" />}
        </AdminAuthButton>
      </form>
    </AdminAuthCard>
  );
}
