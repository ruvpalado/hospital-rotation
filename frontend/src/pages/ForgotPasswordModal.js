import React, { useState } from 'react';
import api from '../api/axios';

/**
 * Email-based password recovery, opened from the "Forgot Password?" link on
 * the Login page. Three steps, matching the three backend endpoints
 * (POST /forgot-password, /verify-reset-code, /reset-password):
 *   1. Enter email -> request a one-time 6-digit code (emailed to the user).
 *   2. Enter that code -> verified against the hashed code stored server-side.
 *   3. Set a new password -> code + new password are re-validated together
 *      server-side and the password is updated.
 *
 * The code itself is never trusted client-side -- every step re-checks with
 * the backend, and the final reset re-validates the code again rather than
 * relying on step 2 having passed.
 */
export default function ForgotPasswordModal({ onClose }) {
  const [step, setStep] = useState(1); // 1 = email, 2 = code, 3 = new password, 4 = done
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const handleRequestCode = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await api.post('/forgot-password', { email: email.trim() });
      setInfo(res.data.message || 'If an account exists for that email, a reset code has been sent.');
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send reset code.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await api.post('/verify-reset-code', { email: email.trim(), code: code.trim() });
      setInfo('');
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid or expired code.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/reset-password', { email: email.trim(), code: code.trim(), newPassword });
      setStep(4);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reset password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal d-block" tabIndex={-1} style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Reset Password</h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>

          {step === 1 && (
            <form onSubmit={handleRequestCode}>
              <div className="modal-body">
                {error && <div className="alert alert-danger py-2">{error}</div>}
                <p className="text-muted small">
                  Enter the email address associated with your account. We'll send a one-time code to reset your password.
                </p>
                <div className="mb-3">
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    className="form-control"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Sending...' : 'Send Code'}
                </button>
              </div>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleVerifyCode}>
              <div className="modal-body">
                {info && <div className="alert alert-info py-2">{info}</div>}
                {error && <div className="alert alert-danger py-2">{error}</div>}
                <p className="text-muted small">
                  Enter the 6-digit code sent to <strong>{email}</strong>. It expires in 15 minutes.
                </p>
                <div className="mb-3">
                  <label className="form-label">Reset Code</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    className="form-control"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    required
                    autoFocus
                  />
                </div>
                <button
                  type="button"
                  className="btn btn-link p-0 small"
                  disabled={submitting}
                  onClick={handleRequestCode}
                >
                  Didn't get a code? Resend
                </button>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setStep(1)} disabled={submitting}>Back</button>
                <button type="submit" className="btn btn-primary" disabled={submitting || code.length !== 6}>
                  {submitting ? 'Verifying...' : 'Verify Code'}
                </button>
              </div>
            </form>
          )}

          {step === 3 && (
            <form onSubmit={handleResetPassword}>
              <div className="modal-body">
                {error && <div className="alert alert-danger py-2">{error}</div>}
                <div className="mb-3">
                  <label className="form-label">New Password</label>
                  <input
                    type="password"
                    className="form-control"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={8}
                    autoFocus
                  />
                  <div className="form-text">At least 8 characters.</div>
                </div>
                <div className="mb-3">
                  <label className="form-label">Confirm New Password</label>
                  <input
                    type="password"
                    className="form-control"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Resetting...' : 'Reset Password'}
                </button>
              </div>
            </form>
          )}

          {step === 4 && (
            <>
              <div className="modal-body">
                <div className="alert alert-success py-2 mb-0">
                  Your password has been reset. You can now log in with your new password.
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-primary" onClick={onClose}>Return to Log In</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
