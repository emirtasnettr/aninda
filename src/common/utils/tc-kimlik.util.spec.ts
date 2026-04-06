import { isValidTurkishNationalId } from './tc-kimlik.util';

describe('isValidTurkishNationalId', () => {
  it('rejects wrong length', () => {
    expect(isValidTurkishNationalId('123')).toBe(false);
    expect(isValidTurkishNationalId('123456789012')).toBe(false);
  });

  it('rejects leading zero', () => {
    expect(isValidTurkishNationalId('01234567890')).toBe(false);
  });

  it('rejects all same digit', () => {
    expect(isValidTurkishNationalId('11111111111')).toBe(false);
  });

  it('accepts a known valid sample', () => {
    expect(isValidTurkishNationalId('10000000146')).toBe(true);
  });
});
