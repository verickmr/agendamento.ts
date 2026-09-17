export function formatPhone(value: string) {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  const international =
    value.trimStart().startsWith('+') || (digits.startsWith('55') && digits.length > 11);
  if (international && !digits.startsWith('55')) return `+${digits}`;
  const prefix = international ? '+55 ' : '';
  const national = international ? digits.slice(2) : digits;
  if (!national) return prefix.trimEnd();
  if (national.length <= 2) return `${prefix}(${national}`;
  const subscriber = national.slice(2);
  const split = subscriber.startsWith('9') ? 5 : 4;
  const number =
    subscriber.length > split
      ? `${subscriber.slice(0, split)}-${subscriber.slice(split)}`
      : subscriber;
  return `${prefix}(${national.slice(0, 2)}) ${number}`;
}

export function phoneCaret(formatted: string, digitCount: number) {
  if (digitCount === 0) return formatted.startsWith('+') ? 1 : formatted.startsWith('(') ? 1 : 0;
  let seen = 0;
  for (let index = 0; index < formatted.length; index++) {
    if (/\d/.test(formatted[index]) && ++seen === digitCount) return index + 1;
  }
  return formatted.length;
}
