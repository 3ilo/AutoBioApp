import { ReactNode, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { usePresignedUrl } from '../hooks/usePresignedUrl';
import { UserCircleIcon, Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { isAuthenticated, logout, user } = useAuthStore();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Convert user avatar to pre-signed URL for display
  const userAvatarUrl = usePresignedUrl(user?.avatar);

  const navigationLinks = [
    { to: '/contribute', label: 'Contribute' },
    { to: '/memories', label: 'Memories' },
    { to: '/explore', label: 'Explore' },
    { to: '/profile', label: 'Profile' },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-200">
        <div className="w-full px-6 sm:px-8 lg:px-12">
          <div className="flex justify-between h-20">
            <div className="flex items-center">
              <Link to="/" className="flex-shrink-0 flex items-center">
                <span className="text-2xl font-semibold text-slate-900 tracking-tight">AutoBio</span>
              </Link>
              {isAuthenticated && (
                <div className="hidden sm:ml-12 sm:flex sm:space-x-1">
                  {navigationLinks.map((link) => (
                    <Link
                      key={link.to}
                      to={link.to}
                      className="inline-flex items-center px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-all duration-150"
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center">
              {isAuthenticated ? (
                <>
                  {/* Mobile menu button */}
                  <button
                    type="button"
                    className="sm:hidden inline-flex items-center justify-center p-2 border border-slate-200 hover:border-slate-900 hover:bg-slate-900 hover:text-white text-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:ring-offset-2 transition-all duration-150"
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  >
                    <span className="sr-only">Open main menu</span>
                    {isMobileMenuOpen ? (
                      <XMarkIcon className="block h-5 w-5" aria-hidden="true" />
                    ) : (
                      <Bars3Icon className="block h-5 w-5" aria-hidden="true" />
                    )}
                  </button>

                  {/* Desktop profile dropdown */}
                  <div className="hidden sm:block relative">
                    <button
                      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                      className="flex items-center space-x-3 focus:outline-none border border-slate-200 hover:border-slate-900 px-3 py-2 transition-all duration-150"
                    >
                      {user?.avatar ? (
                        <img
                          src={userAvatarUrl}
                          alt={`${user?.firstName} ${user?.lastName}`}
                          className="h-8 w-8 object-cover border border-slate-200"
                        />
                      ) : (
                        <UserCircleIcon className="h-8 w-8 text-slate-400" />
                      )}
                      <span className="text-sm font-medium text-slate-900 uppercase tracking-wide">{user?.firstName} {user?.lastName}</span>
                    </button>
                    
                    {isDropdownOpen && (
                      <div className="absolute right-0 mt-2 w-56 bg-white border-2 border-slate-900 z-50">
                        <div className="py-1" role="menu">
                          <Link
                            to="/profile"
                            className="block px-4 py-3 text-sm font-medium text-slate-900 hover:bg-slate-900 hover:text-white uppercase tracking-wide transition-all duration-150"
                            role="menuitem"
                            onClick={() => setIsDropdownOpen(false)}
                          >
                            Profile
                          </Link>
                          <button
                            onClick={() => {
                              logout();
                              setIsDropdownOpen(false);
                            }}
                            className="block w-full text-left px-4 py-3 text-sm font-medium text-slate-900 hover:bg-slate-900 hover:text-white uppercase tracking-wide transition-all duration-150"
                            role="menuitem"
                          >
                            Logout
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-3">
                  <Link
                    to="/login"
                    className="btn-secondary"
                  >
                    Login
                  </Link>
                  <Link
                    to="/register"
                    className="btn-primary"
                  >
                    Register
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {isAuthenticated && isMobileMenuOpen && (
          <div className="sm:hidden border-t border-slate-200">
            <div className="pt-2 pb-3 space-y-1">
              {navigationLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="block pl-6 pr-4 py-3 text-sm font-semibold uppercase tracking-wider text-slate-600 hover:bg-slate-900 hover:text-white transition-all duration-150"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              <button
                onClick={() => {
                  logout();
                  setIsMobileMenuOpen(false);
                }}
                className="block w-full text-left pl-6 pr-4 py-3 text-sm font-semibold uppercase tracking-wider text-slate-600 hover:bg-slate-900 hover:text-white transition-all duration-150"
              >
                Logout
              </button>
            </div>
          </div>
        )}
      </nav>

      <main className="w-full">
        {children}
      </main>
    </div>
  );
} 