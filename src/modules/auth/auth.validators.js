'use strict';

const { z } = require('../../schemas');

const email = z.string().trim().toLowerCase().email('Enter a valid email address').max(254);
const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be 72 characters or fewer')
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), 'Password must include at least one letter and one number');

const registerBody = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
  email,
  password,
});

const loginBody = z.object({
  email,
  password: z.string().min(1, 'Password is required').max(200),
});

const refreshBody = z.object({ refreshToken: z.string().min(20, 'Refresh token is required').max(300) });

const changePasswordBody = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required').max(200),
    newPassword: password,
  })
  .refine((v) => v.currentPassword !== v.newPassword, {
    path: ['newPassword'],
    message: 'New password must be different from the current password',
  });

const updateMeBody = z.object({ name: z.string().trim().min(2).max(80) });

module.exports = { registerBody, loginBody, refreshBody, changePasswordBody, updateMeBody };
