import { forwardRef, useLayoutEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { formatPhone, phoneCaret } from '@/lib/phone';

type PhoneInputProps = Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange' | 'type'> & {
  value: string;
  onChange: (value: string) => void;
};

export const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(function PhoneInput(
  { value, onChange, ...props },
  forwardedRef,
) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const caret = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (caret.current !== null) {
      inputRef.current?.setSelectionRange(caret.current, caret.current);
      caret.current = null;
    }
  }, [value]);

  function change(raw: string, position: number) {
    const masked = formatPhone(raw);
    const digitsBeforeCaret = raw.slice(0, position).replace(/\D/g, '').length;
    const nextCaret = phoneCaret(masked, digitsBeforeCaret);
    // Restore immediately too: deleting punctuation may leave the controlled value unchanged.
    if (inputRef.current) {
      inputRef.current.value = masked;
      inputRef.current.setSelectionRange(nextCaret, nextCaret);
    }
    caret.current = nextCaret;
    onChange(masked);
  }

  return (
    <Input
      {...props}
      ref={(element) => {
        inputRef.current = element;
        if (typeof forwardedRef === 'function') forwardedRef(element);
        else if (forwardedRef) forwardedRef.current = element;
      }}
      type="tel"
      inputMode="tel"
      value={value}
      onChange={(event) =>
        change(event.target.value, event.target.selectionStart ?? event.target.value.length)
      }
      onKeyDown={(event) => {
        if (event.key !== 'Backspace' && event.key !== 'Delete') return;
        if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
        const input = event.currentTarget;
        const start = input.selectionStart ?? 0;
        if (start !== input.selectionEnd) return;
        const direction = event.key === 'Backspace' ? -1 : 1;
        let index = direction === -1 ? start - 1 : start;
        if (index < 0 || index >= value.length || /\d/.test(value[index])) return;
        while (index >= 0 && index < value.length && !/\d/.test(value[index])) index += direction;
        if (index < 0 || index >= value.length) return;
        event.preventDefault();
        change(value.slice(0, index) + value.slice(index + 1), direction === -1 ? index : start);
      }}
    />
  );
});
