import { useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const nav = [
  { to: '/', label: 'Dashboard' },
  { to: '/quadras', label: 'Quadras' },
  { to: '/agenda', label: 'Agenda' },
  { to: '/campeonatos', label: 'Campeonatos' },
  { to: '/ligas', label: 'Ligas' },
  { to: '/financeiro', label: 'Financeiro' },
  { to: '/perfil', label: 'Perfil' },
];

const isAdminOrInstructor = (profile) =>
  profile?.role === 'admin' || profile?.role === 'instructor';

const linkClass = (isActive, desktop = false) =>
  `block px-3 py-2 rounded-lg text-sm font-medium ${desktop ? 'whitespace-nowrap' : ''} ${isActive ? 'bg-ocean-500 text-white' : 'text-gray-600 hover:bg-sand-100'}`;

export default function Layout() {
  const { profile, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const navLinks = [
    ...nav,
    ...(isAdminOrInstructor(profile) ? [{ to: '/configuracoes', label: 'Configurações' }] : []),
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-sand-200 shadow-sm relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-8 h-20">
            <NavLink to="/" className="flex items-center shrink-0" onClick={() => setMenuOpen(false)}>
              <img src="/images/logo2.png" alt="Beach Flow" className="h-28 w-auto object-contain" />
            </NavLink>

            {/* Desktop: menu horizontal */}
            <nav className="hidden md:flex items-center gap-1 overflow-x-auto shrink min-w-0">
              {navLinks.map(({ to, label }) => (
                <NavLink key={to} to={to} className={({ isActive }) => linkClass(isActive, true)}>
                  {label}
                </NavLink>
              ))}
              <button
                type="button"
                onClick={() => signOut()}
                className="ml-2 px-3 py-2 text-sm text-gray-600 hover:bg-sand-100 rounded-lg"
              >
                Sair
              </button>
            </nav>

            {/* Mobile: botão hamburger */}
            <div className="md:hidden flex items-center">
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                className="p-2 rounded-lg text-gray-600 hover:bg-sand-100"
                aria-expanded={menuOpen}
                aria-label="Abrir menu"
              >
                {menuOpen ? (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile: overlay e dropdown do menu */}
        {menuOpen && (
          <>
            <button
              type="button"
              className="md:hidden fixed inset-0 bg-black/30 z-40"
              aria-label="Fechar menu"
              onClick={() => setMenuOpen(false)}
            />
            <div className="md:hidden absolute top-full left-0 right-0 bg-white border-b border-sand-200 shadow-lg z-50">
              <nav className="px-4 py-3 flex flex-col gap-1 max-h-[70vh] overflow-y-auto">
              {navLinks.map(({ to, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) => linkClass(isActive, false)}
                  onClick={() => setMenuOpen(false)}
                >
                  {label}
                </NavLink>
              ))}
              <button
                type="button"
                onClick={() => { setMenuOpen(false); signOut(); }}
                className="text-left px-3 py-2 text-sm text-gray-600 hover:bg-sand-100 rounded-lg font-medium"
              >
                Sair
              </button>
            </nav>
            </div>
          </>
        )}
      </header>
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Outlet />
      </main>
    </div>
  );
}
