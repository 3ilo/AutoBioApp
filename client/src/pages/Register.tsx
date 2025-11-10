import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import logger from '../utils/logger';

export function Register() {
  const navigate = useNavigate();
  const { register, error, setError } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const userData = {
      email: formData.get('email') as string,
      password: formData.get('password') as string,
      firstName: formData.get('firstName') as string,
      lastName: formData.get('lastName') as string,
      age: parseInt(formData.get('age') as string),
      registrationSecret: formData.get('registrationSecret') as string || undefined,
    };

    try {
      await register(userData);
      logger.info('User registered successfully');
      navigate('/');
    } catch (error) {
      logger.error('Registration failed', { 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full px-6 sm:px-8 lg:px-12 py-12 flex items-center justify-center min-h-[calc(100vh-5rem)]">
      <div className="max-w-md w-full">
        <div className="mb-12 text-center">
          <h2 className="text-4xl font-semibold text-slate-900 tracking-tight mb-2">
            Create your account
          </h2>
          <p className="text-sm text-slate-500 uppercase tracking-wider">
            Join the community
          </p>
        </div>
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="firstName" className="form-label">
                First Name
              </label>
              <input
                id="firstName"
                name="firstName"
                type="text"
                required
                className="input-field"
                placeholder="First Name"
              />
            </div>
            <div>
              <label htmlFor="lastName" className="form-label">
                Last Name
              </label>
              <input
                id="lastName"
                name="lastName"
                type="text"
                required
                className="input-field"
                placeholder="Last Name"
              />
            </div>
            <div>
              <label htmlFor="email" className="form-label">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="input-field"
                placeholder="Email address"
              />
            </div>
            <div>
              <label htmlFor="password" className="form-label">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                className="input-field"
                placeholder="Password"
              />
            </div>
            <div>
              <label htmlFor="age" className="form-label">
                Age
              </label>
              <input
                id="age"
                name="age"
                type="number"
                required
                className="input-field"
                placeholder="Age"
              />
            </div>
            <div>
              <label htmlFor="registrationSecret" className="form-label">
                Registration Secret
              </label>
              <input
                id="registrationSecret"
                name="registrationSecret"
                type="password"
                className="input-field"
                placeholder="Registration Secret"
              />
            </div>
          </div>

          {error && (
            <div className="error-text text-center">{error}</div>
          )}

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full"
            >
              {isLoading ? 'Creating account...' : 'Create account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 