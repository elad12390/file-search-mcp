/**
 * Test Fixtures
 * 
 * Creates a realistic project structure for black-box testing.
 * We test BEHAVIOR - what the tools do with real files - not implementation.
 */

import { mkdir, writeFile, rm, symlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

export interface TestFixture {
  rootDir: string;
  cleanup: () => Promise<void>;
}

/**
 * Creates a temporary project structure that mimics a real monorepo.
 * 
 * Structure:
 * test-project/
 * ├── src/
 * │   ├── components/
 * │   │   ├── Button.tsx
 * │   │   ├── Modal.tsx
 * │   │   └── UserProfile.tsx
 * │   ├── utils/
 * │   │   ├── formatters.ts
 * │   │   └── validators.ts
 * │   └── index.ts
 * ├── tests/
 * │   └── Button.test.ts
 * ├── config/
 * │   ├── app.config.json
 * │   └── .env.local
 * ├── node_modules/
 * │   └── some-package/
 * │       └── index.js
 * ├── .git/
 * │   └── config
 * ├── .gitignore
 * ├── package.json
 * └── README.md
 */
export async function createTestFixture(): Promise<TestFixture> {
  const rootDir = join(tmpdir(), `file-search-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  
  // Create directory structure
  const dirs = [
    'src/components',
    'src/utils',
    'tests',
    'config',
    'node_modules/some-package',
    '.git',
    'docs',
    'empty-dir',
  ];
  
  for (const dir of dirs) {
    await mkdir(join(rootDir, dir), { recursive: true });
  }
  
  // Create files with realistic content
  const files: Record<string, string> = {
    // Source files
    'src/components/Button.tsx': `
import React from 'react';

interface ButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

// TODO: Add loading state
export function Button({ label, onClick, disabled }: ButtonProps) {
  return (
    <button onClick={onClick} disabled={disabled}>
      {label}
    </button>
  );
}
`.trim(),

    'src/components/Modal.tsx': `
import React from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

// FIXME: Handle escape key
export function Modal({ isOpen, onClose, children }: ModalProps) {
  if (!isOpen) return null;
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
`.trim(),

    'src/components/UserProfile.tsx': `
import React from 'react';
import { formatDate } from '../utils/formatters';

interface User {
  name: string;
  email: string;
  createdAt: Date;
}

export function UserProfile({ user }: { user: User }) {
  return (
    <div className="user-profile">
      <h2>{user.name}</h2>
      <p>Email: {user.email}</p>
      <p>Member since: {formatDate(user.createdAt)}</p>
    </div>
  );
}
`.trim(),

    'src/utils/formatters.ts': `
/**
 * Utility functions for formatting data
 */

export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
}

// TODO: Add more formatters
export function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\\D/g, '');
  const match = cleaned.match(/^(\\d{3})(\\d{3})(\\d{4})$/);
  if (match) {
    return '(' + match[1] + ') ' + match[2] + '-' + match[3];
  }
  return phone;
}
`.trim(),

    'src/utils/validators.ts': `
/**
 * Validation utilities
 */

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
  return emailRegex.test(email);
}

export function isValidPassword(password: string): boolean {
  // At least 8 characters, one uppercase, one lowercase, one number
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).{8,}$/;
  return passwordRegex.test(password);
}

// API key validation
const API_KEY_PATTERN = /^sk-[a-zA-Z0-9]{32}$/;
export function isValidApiKey(key: string): boolean {
  return API_KEY_PATTERN.test(key);
}
`.trim(),

    'src/index.ts': `
// Main entry point
export * from './components/Button';
export * from './components/Modal';
export * from './components/UserProfile';
export * from './utils/formatters';
export * from './utils/validators';

console.log('App initialized');
`.trim(),

    // Test files
    'tests/Button.test.ts': `
import { describe, it, expect } from 'vitest';

describe('Button', () => {
  it('renders with label', () => {
    // TODO: Implement test
    expect(true).toBe(true);
  });
  
  it('calls onClick when clicked', () => {
    // TODO: Implement test
    expect(true).toBe(true);
  });
});
`.trim(),

    // Config files
    'config/app.config.json': `{
  "appName": "Test Application",
  "version": "1.0.0",
  "apiEndpoint": "https://api.example.com",
  "features": {
    "darkMode": true,
    "notifications": true
  }
}`,

    'config/.env.local': `
# Local environment variables
API_KEY=sk-test-1234567890
DATABASE_URL=postgresql://localhost:5432/test
SECRET_KEY=super-secret-key-12345
`.trim(),

    // Node modules (should be ignored)
    'node_modules/some-package/index.js': `
module.exports = { name: 'some-package' };
`.trim(),

    // Git directory (should be ignored)
    '.git/config': `
[core]
  repositoryformatversion = 0
`.trim(),

    // Root files
    '.gitignore': `
node_modules/
dist/
.env
.env.local
*.log
`.trim(),

    'package.json': `{
  "name": "test-project",
  "version": "1.0.0",
  "dependencies": {
    "react": "^18.0.0"
  }
}`,

    'README.md': `
# Test Project

This is a test project for the file-search-mcp tool.

## Features

- Component library
- Utility functions
- Full test coverage

## Getting Started

\`\`\`bash
npm install
npm run dev
\`\`\`
`.trim(),

    // Documentation
    'docs/API.md': `
# API Documentation

## Endpoints

### GET /users
Returns a list of users.

### POST /users
Creates a new user.
`.trim(),

    // Large file for testing size filters
    'docs/large-file.txt': 'x'.repeat(100000), // 100KB file
  };
  
  for (const [filePath, content] of Object.entries(files)) {
    await writeFile(join(rootDir, filePath), content, 'utf-8');
  }
  
  // Create a symlink for testing symlink handling
  try {
    await symlink(
      join(rootDir, 'src/components'),
      join(rootDir, 'components-link')
    );
  } catch {
    // Symlinks might fail on some systems, that's OK
  }
  
  const cleanup = async () => {
    await rm(rootDir, { recursive: true, force: true });
  };
  
  return { rootDir, cleanup };
}

/**
 * Creates a minimal fixture for quick tests
 */
export async function createMinimalFixture(): Promise<TestFixture> {
  const rootDir = join(tmpdir(), `file-search-minimal-${Date.now()}`);
  
  await mkdir(join(rootDir, 'src'), { recursive: true });
  
  await writeFile(join(rootDir, 'src/app.ts'), 'console.log("hello");');
  await writeFile(join(rootDir, 'src/utils.ts'), 'export const add = (a, b) => a + b;');
  await writeFile(join(rootDir, 'config.json'), '{"key": "value"}');
  
  const cleanup = async () => {
    await rm(rootDir, { recursive: true, force: true });
  };
  
  return { rootDir, cleanup };
}
