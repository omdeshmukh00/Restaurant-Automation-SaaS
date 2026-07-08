import { updateProfileSchema } from '../../modules/users/users.schema';

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
});
