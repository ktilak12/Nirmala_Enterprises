import mongoose from 'mongoose';
import { ROLES } from '../config/permissions.js';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Enter a valid email address.'],
    },
    // bcrypt hash. Never select this by default so it cannot leak through a
    // stray `res.json(user)` anywhere in the codebase.
    passwordHash: { type: String, required: true, select: false },
    role: {
      type: String,
      required: true,
      enum: Object.values(ROLES),
      default: ROLES.SALES_STAFF,
    },
    phone: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
    mustChangePassword: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

userSchema.index({ role: 1, isActive: 1 });

userSchema.set('toJSON', {
  transform(_doc, ret) {
    delete ret.passwordHash;
    return ret;
  },
});

export const User = mongoose.model('User', userSchema);
