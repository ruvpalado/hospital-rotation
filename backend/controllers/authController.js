const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, Role, Site, Department } = require('../models');

function signToken(user, roleKey) {
  return jwt.sign(
    {
      id: user.id,
      role: roleKey,
      siteId: user.home_site_id,
      departmentId: user.home_department_id,
      fullName: user.full_name,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );
}

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
    });

    const token = signToken(user, role.key);
    return res.status(201).json({ token, user: publicUser(user, role) });
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

    const token = signToken(user, user.Role.key);
    return res.json({ token, user: publicUser(user, user.Role) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Login failed', details: err.message });
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
  };
}
