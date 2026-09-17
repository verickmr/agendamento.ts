import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vitest';

// DOM updates can be delayed while Turbo runs builds and tests concurrently.
configure({ asyncUtilTimeout: 3000 });

afterEach(() => cleanup());
