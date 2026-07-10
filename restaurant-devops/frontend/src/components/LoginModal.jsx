import React, { useState } from 'react';
import { LogIn, UserPlus, X, ShieldAlert } from 'lucide-react';

export default function LoginModal({ isOpen, onClose, onLoginSuccess, apiBaseUrl, isMockMode }) {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('customer');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (isMockMode) {
      // Mock Authentication flow
      setTimeout(() => {
        const mockUser = {
          id: Math.floor(Math.random() * 1000),
          name: isRegister ? name : email.split('@')[0],
          email,
          role: isRegister ? role : (email.includes('admin') ? 'admin' : email.includes('chef') ? 'chef' : email.includes('delivery') ? 'delivery' : 'customer'),
          phone: phone || '123-456-7890'
        };
        onLoginSuccess('mock_token_123', mockUser);
        setLoading(false);
        onClose();
      }, 800);
      return;
    }

    // Real API Authentication
    const endpoint = isRegister ? `${apiBaseUrl}/api/auth/register` : `${apiBaseUrl}/api/auth/login`;
    const payload = isRegister ? { name, email, password, role, phone } : { email, password };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      onLoginSuccess(data.token, data.user);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100
    }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '420px', padding: '32px', position: 'relative' }}>
        <button onClick={onClose} style={{
          position: 'absolute', top: 16, right: 16, background: 'none', border: 'none',
          color: 'var(--text-secondary)', cursor: 'pointer'
        }}>
          <X size={20} />
        </button>

        <h2 style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isRegister ? <UserPlus className="text-primary" /> : <LogIn className="text-primary" />}
          {isRegister ? 'Create Account' : 'Sign In'}
        </h2>

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--accent-danger)',
            borderRadius: 'var(--border-radius-sm)', padding: '12px', color: 'var(--accent-danger)',
            fontSize: '0.85rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px'
          }}>
            <ShieldAlert size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {isRegister && (
            <div>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Full Name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} required placeholder="John Doe" />
            </div>
          )}

          <div>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Email Address</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="john@example.com" />
          </div>

          <div>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" />
          </div>

          {isRegister && (
            <>
              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Phone Number</label>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="123-456-7890" />
              </div>
              
              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Account Role</label>
                <select value={role} onChange={(e) => setRole(e.target.value)} style={{ width: '100%' }}>
                  <option value="customer">Customer</option>
                  <option value="chef">Chef</option>
                  <option value="delivery">Delivery Driver</option>
                  <option value="admin">Administrator (Admin)</option>
                </select>
              </div>
            </>
          )}

          <button type="submit" className="btn btn-primary" style={{ marginTop: '8px' }} disabled={loading}>
            {loading ? 'Processing...' : (isRegister ? 'Register' : 'Sign In')}
          </button>
        </form>

        <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          {isRegister ? (
            <span>Already have an account? <a href="#" onClick={() => setIsRegister(false)} style={{ color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 'bold' }}>Sign In</a></span>
          ) : (
            <span>New to the platform? <a href="#" onClick={() => setIsRegister(true)} style={{ color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 'bold' }}>Create Account</a></span>
          )}
        </div>
      </div>
    </div>
  );
}
