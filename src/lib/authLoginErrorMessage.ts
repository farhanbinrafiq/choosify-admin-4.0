/** Maps backend auth errors to user-facing copy (matches Choosify-Web authSession). */
export function authLoginErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error || '');
  const lower = message.toLowerCase();
  if (lower.includes('invalid email or password')) {
    return 'Incorrect email or password.';
  }
  if (lower.includes('invalid email') || lower.includes('valid email')) {
    return 'Please enter a valid email address.';
  }
  if (lower.includes('disabled')) {
    return 'This account has been disabled.';
  }
  if (
    lower.includes('incorrect') ||
    lower.includes('unauthorized') ||
    lower.includes('401')
  ) {
    return 'Incorrect email or password.';
  }
  if (lower.includes('already') || lower.includes('exists') || lower.includes('in use')) {
    return 'An account with this email already exists. Sign in instead.';
  }
  if (lower.includes('password') && lower.includes('8')) {
    return 'Password must be at least 8 characters.';
  }
  if (lower.includes('too many')) {
    return 'Too many attempts. Please wait and try again.';
  }
  if (lower.includes('network') || lower.includes('failed to fetch')) {
    return 'Network error. Check your connection and try again.';
  }
  return message || 'Authentication failed.';
}
