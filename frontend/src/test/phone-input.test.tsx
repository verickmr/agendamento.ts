import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { PhoneInput } from '@/components/phone-input';
import { formatPhone } from '@/lib/phone';

function Form() {
  const [value, setValue] = useState('');
  return <PhoneInput aria-label="Telefone" value={value} onChange={setValue} />;
}

describe('phone mask', () => {
  it('formats fixed, mobile and international numbers without truncating extra digits', () => {
    expect(formatPhone('1123456789')).toBe('(11) 2345-6789');
    expect(formatPhone('11987654321')).toBe('(11) 98765-4321');
    expect(formatPhone('+55 (11) 98765-4321')).toBe('+55 (11) 98765-4321');
    expect(formatPhone('55987654321')).toBe('(55) 98765-4321');
    expect(formatPhone('119876543210')).toBe('(11) 98765-43210');
    expect(formatPhone('+1 2345678901')).toBe('+12345678901');
  });
  it('supports typing, deleting across separators and replacing a selection', async () => {
    const user = userEvent.setup();
    render(<Form />);
    const input = screen.getByRole('textbox', { name: 'Telefone' }) as HTMLInputElement;
    await user.type(input, '11987654321');
    expect(input).toHaveValue('(11) 98765-4321');
    input.setSelectionRange(12, 12);
    await user.keyboard('{Backspace}');
    expect(input).toHaveValue('(11) 98765-321');
    input.setSelectionRange(11, 11);
    await user.keyboard('{Backspace}');
    expect(input).toHaveValue('(11) 98763-21');
    await user.clear(input);
    await user.type(input, '1123456789');
    expect(input).toHaveValue('(11) 2345-6789');
    input.setSelectionRange(1, 3);
    await user.keyboard('21');
    expect(input).toHaveValue('(21) 2345-6789');
    await user.clear(input);
    expect(input).toHaveValue('');
  });
  it('supports paste with +55, select-all replacement and forward delete', async () => {
    const user = userEvent.setup();
    render(<Form />);
    const input = screen.getByRole('textbox', { name: 'Telefone' }) as HTMLInputElement;
    await user.click(input);
    await user.paste('+55 (11) 98765-4321');
    expect(input).toHaveValue('+55 (11) 98765-4321');
    await user.keyboard('{Control>}a{/Control}');
    await user.paste('2134567890');
    expect(input).toHaveValue('(21) 3456-7890');
    input.setSelectionRange(9, 9);
    await user.keyboard('{Delete}');
    expect(input).toHaveValue('(21) 3456-890');
    expect(input.selectionStart).toBe(9);
  });
});
