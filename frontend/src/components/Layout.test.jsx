import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Layout from './Layout';

const mockSignOut = vi.fn();
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ profile: { role: 'student' }, signOut: mockSignOut }),
}));

describe('Layout', () => {
  it('renders Beach Flow brand and main nav', () => {
    render(
      <BrowserRouter>
        <Layout />
      </BrowserRouter>
    );
    expect(screen.getByText(/Beach Flow/)).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Quadras')).toBeInTheDocument();
    expect(screen.getByText('Sair')).toBeInTheDocument();
  });
});
