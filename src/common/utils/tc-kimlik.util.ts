/** Türkiye Cumhuriyeti 11 haneli T.C. kimlik numarası algoritma doğrulaması */
export function isValidTurkishNationalId(raw: string): boolean {
  const digits = raw.replace(/\D/g, '');
  if (digits.length !== 11) {
    return false;
  }
  if (digits[0] === '0') {
    return false;
  }
  const n = digits.split('').map((c) => Number(c));
  if (n.some((x) => Number.isNaN(x))) {
    return false;
  }
  const oddSum = n[0] + n[2] + n[4] + n[6] + n[8];
  const evenSum = n[1] + n[3] + n[5] + n[7];
  let d10 = (oddSum * 7 - evenSum) % 10;
  if (d10 < 0) {
    d10 += 10;
  }
  if (d10 !== n[9]) {
    return false;
  }
  const sum10 = n.slice(0, 10).reduce((a, b) => a + b, 0);
  return sum10 % 10 === n[10];
}
