const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, Role, Site, Department } = require('../models');
const { sendNotification } = require('../services/notificationService');

const RESET_CODE_TTL_MINUTES = 15;

function generateResetCode() {
  // 6-digit numeric code, zero-padded (e.g. "042917"). Never stored raw --
  // only its bcrypt hash is persisted (see forgotPassword below).
  return String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
}

function signToken(user, roleKey) {
  return jwt.sign(
    {
      id: user.id,
      role: roleKey,
      email: user.email,
      siteId: user.home_site_id,
      departmentId: user.home_department_id,
      fullName: user.full_name,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );
}

/**
 * Account Creation Policy: every self-registration starts out 'pending' --
 * no token is issued, so the account can't log in until an admin approves
 * it (admin-role requests require the developer account specifically; see
 * userController.approveUser). This intentionally does NOT auto-login the
 * new account the way it used to.
 */
exports.register = async (req, res) => {
  try {
    const { fullName, email, password, phone, roleKey, siteId, departmentId, languagePref } = req.body;
    if (!fullName || !email || !password || !roleKey) {
      return res.status(400).json({ error: 'fullName, email, password, roleKey are required' });
    }
    const role = await Role.findOne({ where: { key: roleKey } });
    if (!role) return res.status(400).json({ error: `Unknown role: ${roleKey}` });

    const existing = await User.findOne({ where: { email } });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const password_hash = await bcrypt.hash(password, 10);
    const user = await User.create({
      full_name: fullName,
      email,
      phone,
      password_hash,
      role_id: role.id,
      home_site_id: siteId || null,
      home_department_id: departmentId || null,
      language_pref: languagePref || 'en',
      approval_status: 'pending',
    });

    const pendingMessage = roleKey === 'admin'
      ? 'Registration submitted. Admin accounts require approval from the developer account before you can log in.'
      : 'Registration submitted. An admin needs to approve your account before you can log in.';

    // Best-effort: a failed confirmation email shouldn't fail the
    // registration itself (the account is already created and correctly
    // pending -- the applicant just won't get an early heads-up). Errors are
    // logged, not thrown; sendNotification already records the delivery
    // attempt (mock/sent/failed) on the Notification row either way.
    try {
      await sendNotification({
        userId: user.id,
        channel: 'email',
        title: 'Registration Received',
        message: `Hi ${fullName}, thanks for registering for OBGYN Master Rotation as a ${role.label}. ${pendingMessage} We'll email you again once it's been reviewed.`,
        email: user.email,
      });
    } catch (notifyErr) {
      console.error('Failed to send registration confirmation email:', notifyErr.message);
    }

    return res.status(201).json({
      pendingApproval: true,
      message: pendingMessage,
      user: publicUser(user, role),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Registration failed', details: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email }, include: [Role, { model: Site, as: 'homeSite' }, { model: Department, as: 'homeDepartment' }] });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    if (!user.is_active) {
      return res.status(403).json({ error: 'This account has been deactivated. Contact your administrator.' });
    }

    if (user.approval_status === 'pending') {
      return res.status(403).json({ error: 'This account is pending admin approval. Please wait for approval before logging in.' });
    }
    if (user.approval_status === 'rejected') {
      return res.status(403).json({ error: 'This account registration was rejected. Contact an administrator.' });
    }

    const token = signToken(user, user.Role.key);
    return res.json({ token, user: publicUser(user, user.Role) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Login failed', details: err.message });
  }
};

/**
 * Forgot Password step 1: email a one-time 6-digit code. Always returns the
 * same generic message regardless of whether the email is registered, so the
 * endpoint can't be used to enumerate which emails have accounts -- but the
 * email/code is only actually generated and sent when a matching user exists.
 */
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'email is required' });

    const genericResponse = { message: 'If an account exists for that email, a password reset code has been sent to it.' };

    const user = await User.findOne({ where: { email } });
    if (!user) return res.json(genericResponse);

    const code = generateResetCode();
    user.reset_code_hash = await bcrypt.hash(code, 10);
    user.reset_code_expires_at = new Date(Date.now() + RESET_CODE_TTL_MINUTES * 60 * 1000);
    await user.save();

    await sendNotification({
      userId: user.id,
      channel: 'email',
      title: 'Your password reset code',
      message: `Your OBGYN Master Rotation password reset code is: ${code}. It expires in ${RESET_CODE_TTL_MINUTES} minutes. If you didn't request this, you can ignore this email.`,
      email: user.email,
    });

    return res.json(genericResponse);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to send reset code', details: err.message });
  }
};

/**
 * Forgot Password step 2: check the code without consuming it, purely so the
 * frontend can advance from the "enter code" screen to the "set new
 * password" screen. The code is only actually cleared/consumed in
 * resetPassword below, so re-checking it there again is safe and required
 * (this endpoint being called successfully is not by itself sufficient to
 * change the password).
 */
exports.verifyResetCode = async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ error: 'email and code are required' });

    const invalid = { error: 'Invalid or expired code.' };
    const user = await User.findOne({ where: { email } });
    if (!user || !user.reset_code_hash || !user.reset_code_expires_at) return res.status(400).json(invalid);
    if (new Date(user.reset_code_expires_at) < new Date()) return res.status(400).json(invalid);

    const ok = await bcrypt.compare(code, user.reset_code_hash);
    if (!ok) return res.status(400).json(invalid);

    return res.json({ valid: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to verify code', details: err.message });
  }
};

/**
 * Forgot Password step 3: re-validates email+code (independently of step 2 --
 * see note above) and, if valid, sets the new password and clears the reset
 * code so it can't be reused.
 */
exports.resetPassword = async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) {
      return res.status(400).json({ error: 'email, code, and newPassword are required' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }

    const invalid = { error: 'Invalid or expired code.' };
    const user = await User.findOne({ where: { email } });
    if (!user || !user.reset_code_hash || !user.reset_code_expires_at) return res.status(400).json(invalid);
    if (new Date(user.reset_code_expires_at) < new Date()) return res.status(400).json(invalid);

    const ok = await bcrypt.compare(code, user.reset_code_hash);
    if (!ok) return res.status(400).json(invalid);

    user.password_hash = await bcrypt.hash(newPassword, 10);
    user.reset_code_hash = null;
    user.reset_code_expires_at = null;
    await user.save();

    return res.json({ message: 'Password reset successful. You can now log in with your new password.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to reset password', details: err.message });
  }
};

exports.me = async (req, res) => {
  const user = await User.findByPk(req.user.id, {
    include: [Role, { model: Site, as: 'homeSite' }, { model: Department, as: 'homeDepartment' }],
  });
  if (!user) return res.status(404).json({ error: 'User not found' });
  return res.json(publicUser(user, user.Role));
};

function publicUser(user, role) {
  return {
    id: user.id,
    fullName: user.full_name,
    email: user.email,
    phone: user.phone,
    role: role.key,
    roleLabel: role.label,
    homeSiteId: user.home_site_id,
    homeDepartmentId: user.home_department_id,
    languagePref: user.language_pref,
    isActive: user.is_active,
  };
}
