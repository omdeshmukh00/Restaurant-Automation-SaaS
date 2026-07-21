import { updateProfileSchema, changePasswordSchema } from '../../modules/users/users.schema';

describe('User Profile Schema', () => {
  it('accepts themeMode updates with valid values', () => {
    expect(updateProfileSchema.parse({ themeMode: 'light' })).toEqual({ themeMode: 'light' });
    expect(updateProfileSchema.parse({ themeMode: 'dark' })).toEqual({ themeMode: 'dark' });
    expect(updateProfileSchema.parse({ themeMode: 'system' })).toEqual({ themeMode: 'system' });
  });

  it('rejects invalid themeMode values', () => {
    const result = updateProfileSchema.safeParse({ themeMode: 'blue' });
    expect(result.success).toBe(false);
  });

  it('accepts optional otp field in updateProfileSchema', () => {
    const parsed = updateProfileSchema.parse({ email: 'test@example.com', otp: '123456' });
    expect(parsed.otp).toBe('123456');
  });

  it('accepts optional otp field in changePasswordSchema', () => {
    const parsed = changePasswordSchema.parse({
      currentPassword: 'OldPassword1',
      newPassword: 'NewPassword1',
      otp: '654321',
    });
    expect(parsed.otp).toBe('654321');
  });
});
