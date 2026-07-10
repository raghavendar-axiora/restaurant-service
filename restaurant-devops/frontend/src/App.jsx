import React, { useState, useEffect, useRef } from 'react';
import { ChefHat, ShoppingBag, Truck, Shield, User, AlertCircle, LogOut, Radio, RefreshCw, Terminal } from 'lucide-react';
import CustomerView from './components/CustomerView';
import ChefView from './components/ChefView';
import DeliveryView from './components/DeliveryView';
import AdminView from './components/AdminView';
import LoginModal from './components/LoginModal';

// Shared Mock Menu for instant fallback loading
const mockMenu = [
  { id: 1, food_name: "Truffle Burger", price: 18.99, category: "Burgers", availability: true, image_url: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=500&q=80" },
  { id: 2, food_name: "Margherita Pizza", price: 14.50, category: "Pizzas", availability: true, image_url: "https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?auto=format&fit=crop&w=500&q=80" },
  { id: 3, food_name: "Avocado Caesar Salad", price: 12.00, category: "Salads", availability: true, image_url: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=500&q=80" },
  { id: 4, food_name: "Lava Chocolate Cake", price: 8.50, category: "Desserts", availability: true, image_url: "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=500&q=80" },
  { id: 5, food_name: "Spicy Ramen", price: 16.00, category: "Main Course", availability: true, image_url: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=500&q=80" },
  { id: 6, food_name: "Iced Caramel Macchiato", price: 5.50, category: "Beverages", availability: true, image_url: "https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=500&q=80" }
];

export default function App() {
  const [isMockMode, setIsMockMode] = useState(true);
  const [user, setUser] = useState({ id: 99, name: 'Guest Developer', email: 'guest@restaurant.com', role: 'customer' });
  const [token, setToken] = useState('mock_token_123');
  const [activeRole, setActiveRole] = useState('customer'); // simulated view
  const [menuItems, setMenuItems] = useState(mockMenu);
  const [orders, setOrders] = useState([]);
  const [toasts, setToasts] = useState([]);
  
  // Login modal trigger
  const [loginOpen, setLoginOpen] = useState(false);
  
  // Connection states
  const [wsStatus, setWsStatus] = useState('Disconnected');
  const [apiGatewayUrl] = useState('http://localhost:8080');
  const [wsUrl] = useState('ws://localhost:8085');
  
  const wsRef = useRef(null);

  // Toast dispatch helper
  const addToast = (message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  };

  // Connect WebSockets
  const connectWebSocket = () => {
    if (isMockMode) {
      setWsStatus('Connected (Mock Mode)');
      return;
    }

    try {
      if (wsRef.current) wsRef.current.close();
      
      setWsStatus('Connecting...');
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsStatus('Connected');
        addToast('Connected to live Notification Service (WebSockets)', 'success');
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          handleWebSocketMessage(payload);
        } catch (e) {
          console.error('Error parsing WS message:', e);
        }
      };

      ws.onclose = () => {
        setWsStatus('Disconnected');
        // Auto-reconnect in 5s
        setTimeout(() => connectWebSocket(), 5000);
      };
      
      ws.onerror = () => {
        setWsStatus('Error');
      };
    } catch (e) {
      console.error(e);
      setWsStatus('Disconnected');
    }
  };

  // Handle live incoming WebSocket events
  const handleWebSocketMessage = (payload) => {
    const { event, data } = payload;
    console.log('[App] WebSocket event received:', event, data);

    if (event === 'payment.processed') {
      const isSuccess = data.payment_status === 'Success';
      addToast(
        `Order #${data.order_id}: Payment ${data.payment_status}! Transaction ID: ${data.transaction_id}`,
        isSuccess ? 'success' : 'error'
      );
      fetchOrders();
    } else if (event === 'order.updated') {
      addToast(`Order #${data.id} status updated to: ${data.status.toUpperCase()}`, 'info');
      // Update orders array in place
      setOrders(prev => prev.map(o => o.id === data.id ? { ...o, status: data.status } : o));
    }
  };

  // Fetch Menu
  const fetchMenu = async () => {
    if (isMockMode) {
      // Menu uses static fallback
      return;
    }
    try {
      const res = await fetch(`${apiGatewayUrl}/api/menu`);
      const data = await res.json();
      if (res.ok) {
        setMenuItems(data);
      }
    } catch (e) {
      console.error('Error loading menu:', e);
      addToast('Gateway Offline: Menu loaded from mock cache.', 'warning');
    }
  };

  // Fetch Orders
  const fetchOrders = async () => {
    if (isMockMode) return;
    try {
      const res = await fetch(`${apiGatewayUrl}/api/orders`);
      const data = await res.json();
      if (res.ok) {
        setOrders(data);
      }
    } catch (e) {
      console.error('Error loading orders:', e);
    }
  };

  // Sync menu & orders on load or mode switch
  useEffect(() => {
    fetchMenu();
    fetchOrders();
    connectWebSocket();

    // Clean up WS
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, [isMockMode]);

  // Place Order Action
  const placeOrder = async (orderPayload) => {
    if (isMockMode) {
      // Mock Place Order flow
      const newOrder = {
        id: orders.length + 1,
        user_id: orderPayload.user_id,
        total_amount: orderPayload.total_amount,
        status: 'Pending',
        created_at: new Date(),
        items: orderPayload.items.map((it, idx) => ({ id: idx + 1, ...it }))
      };
      
      const newOrders = [newOrder, ...orders];
      setOrders(newOrders);
      addToast(`Order #${newOrder.id} Placed! Simulating Payment processing...`, 'info');

      // Simulate RabbitMQ messaging flows
      setTimeout(() => {
        // Toggle payment success based on total price logic
        const paymentSuccess = orderPayload.total_amount !== 999.00;
        const finalStatus = paymentSuccess ? 'Paid' : 'Payment Failed';
        
        setOrders(prev => prev.map(o => o.id === newOrder.id ? { ...o, status: finalStatus } : o));
        
        addToast(
          `Payment for Order #${newOrder.id} ${paymentSuccess ? 'SUCCESS' : 'FAILED'} (Mock Gateway)`,
          paymentSuccess ? 'success' : 'error'
        );
      }, 3000);

      return newOrder;
    }

    try {
      const res = await fetch(`${apiGatewayUrl}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setOrders(prev => [data, ...prev]);
      addToast(`Order #${data.id} Placed! Processing transaction...`, 'success');
      return data;
    } catch (err) {
      addToast(`Order failed: ${err.message}`, 'error');
      throw err;
    }
  };

  // Update Order Status Action
  const updateOrderStatus = async (orderId, newStatus) => {
    if (isMockMode) {
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
      addToast(`Order #${orderId} status updated to: ${newStatus.toUpperCase()}`, 'info');
      return;
    }

    try {
      const res = await fetch(`${apiGatewayUrl}/api/orders/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // State is updated by WS broadcast or direct response sync
      setOrders(prev => prev.map(o => o.id === orderId ? data : o));
      addToast(`Updated Order #${orderId} to: ${newStatus}`, 'success');
    } catch (err) {
      addToast(`Update failed: ${err.message}`, 'error');
    }
  };

  const handleLoginSuccess = (token, userProfile) => {
    setToken(token);
    setUser(userProfile);
    setActiveRole(userProfile.role);
    addToast(`Signed in as ${userProfile.name} (${userProfile.role.toUpperCase()})`, 'success');
  };

  const handleLogOut = () => {
    setToken(null);
    setUser(null);
    setActiveRole('customer');
    addToast('Logged out successfully', 'info');
  };

  // Filter orders visible to customer vs admin/chef/delivery
  const customerOrders = orders.filter(o => o.user_id === user?.id || true); // In mock mode let customer track all active testing orders

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* Simulation Controls Bar */}
      <div style={{
        background: 'rgba(99, 102, 241, 0.08)', borderBottom: '1px solid rgba(99, 102, 241, 0.15)',
        padding: '10px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
            <Terminal size={14} className="text-primary" />
            <strong>DevOps Sandbox:</strong>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>Mock Engine (Local Offline):</span>
            <label className="toggle-switch">
              <input type="checkbox" checked={isMockMode} onChange={(e) => setIsMockMode(e.target.checked)} />
              <span className="slider"></span>
            </label>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Live WS connection status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Radio size={14} style={{ color: wsStatus.includes('Connected') ? 'var(--accent-success)' : 'var(--accent-danger)' }} />
            <span style={{ color: 'var(--text-secondary)' }}>
              Notifications: <strong style={{ color: wsStatus.includes('Connected') ? 'var(--accent-success)' : 'inherit' }}>{wsStatus}</strong>
            </span>
          </div>

          {!isMockMode && (
            <button 
              onClick={() => { fetchMenu(); fetchOrders(); }}
              style={{ background: 'none', border: 'none', color: 'var(--accent-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <RefreshCw size={12} /> Sync APIs
            </button>
          )}
        </div>
      </div>

      {/* Main Header */}
      <header className="glass-panel" style={{
        borderRadius: 0, borderLeft: 0, borderRight: 0, borderTop: 0,
        position: 'sticky', top: 0, zIndex: 100, padding: '16px 24px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
            width: '40px', height: '40px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 10px 0 var(--accent-primary-glow)'
          }}>
            <ChefHat color="white" size={24} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, background: 'linear-gradient(to right, #fff, #9ca3af)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              BISTRO FLUX
            </h1>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', tracking: '0.1em' }}>
              Microservices Restaurant System
            </span>
          </div>
        </div>

        {/* Role Simulator Switcher */}
        <div className="glass-panel" style={{ display: 'flex', padding: '4px', gap: '4px', borderRadius: '12px' }}>
          <button 
            onClick={() => setActiveRole('customer')}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px', border: 'none', cursor: 'pointer',
              padding: '8px 14px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 'bold',
              background: activeRole === 'customer' ? 'var(--accent-primary)' : 'transparent',
              color: activeRole === 'customer' ? 'white' : 'var(--text-secondary)',
              transition: 'var(--transition-smooth)'
            }}
          >
            <ShoppingBag size={14} /> Customer
          </button>
          
          <button 
            onClick={() => setActiveRole('chef')}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px', border: 'none', cursor: 'pointer',
              padding: '8px 14px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 'bold',
              background: activeRole === 'chef' ? 'var(--accent-primary)' : 'transparent',
              color: activeRole === 'chef' ? 'white' : 'var(--text-secondary)',
              transition: 'var(--transition-smooth)'
            }}
          >
            <ChefHat size={14} /> Kitchen Chef
          </button>

          <button 
            onClick={() => setActiveRole('delivery')}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px', border: 'none', cursor: 'pointer',
              padding: '8px 14px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 'bold',
              background: activeRole === 'delivery' ? 'var(--accent-primary)' : 'transparent',
              color: activeRole === 'delivery' ? 'white' : 'var(--text-secondary)',
              transition: 'var(--transition-smooth)'
            }}
          >
            <Truck size={14} /> Delivery
          </button>

          <button 
            onClick={() => setActiveRole('admin')}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px', border: 'none', cursor: 'pointer',
              padding: '8px 14px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 'bold',
              background: activeRole === 'admin' ? 'var(--accent-primary)' : 'transparent',
              color: activeRole === 'admin' ? 'white' : 'var(--text-secondary)',
              transition: 'var(--transition-smooth)'
            }}
          >
            <Shield size={14} /> Admin
          </button>
        </div>

        {/* User Account Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 'bold', display: 'block' }}>{user.name}</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{user.role}</span>
              </div>
              <button className="btn btn-secondary" style={{ padding: '8px 12px' }} onClick={handleLogOut}>
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button className="btn btn-primary" onClick={() => setLoginOpen(true)}>
              <User size={16} /> Sign In
            </button>
          )}
        </div>
      </header>

      {/* Main Content Body */}
      <main className="container" style={{ flexGrow: 1, paddingBottom: '80px' }}>
        {activeRole === 'customer' && (
          <CustomerView 
            menuItems={menuItems} 
            orderHistory={customerOrders} 
            placeOrder={placeOrder} 
            wsStatus={wsStatus} 
            user={user} 
          />
        )}
        
        {activeRole === 'chef' && (
          <ChefView 
            orders={orders} 
            menuItems={menuItems} 
            updateOrderStatus={updateOrderStatus} 
          />
        )}

        {activeRole === 'delivery' && (
          <DeliveryView 
            orders={orders} 
            menuItems={menuItems} 
            updateOrderStatus={updateOrderStatus} 
            user={user} 
          />
        )}

        {activeRole === 'admin' && (
          <AdminView 
            menuItems={menuItems} 
            apiBaseUrl={apiGatewayUrl} 
            isMockMode={isMockMode} 
            onMenuChange={setMenuItems} 
          />
        )}
      </main>

      {/* Toasts Container */}
      <div className="toast-container">
        {toasts.map(toast => (
          <div 
            key={toast.id} 
            className={`glass-panel toast toast-${toast.type}`}
          >
            <AlertCircle size={20} style={{
              color: toast.type === 'success' ? 'var(--accent-success)' :
                     toast.type === 'error' ? 'var(--accent-danger)' :
                     toast.type === 'warning' ? 'var(--accent-warning)' : 'var(--accent-secondary)'
            }} />
            <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{toast.message}</span>
          </div>
        ))}
      </div>

      {/* Login Modal */}
      <LoginModal 
        isOpen={loginOpen} 
        onClose={() => setLoginOpen(false)} 
        onLoginSuccess={handleLoginSuccess}
        apiBaseUrl={apiGatewayUrl}
        isMockMode={isMockMode}
      />

    </div>
  );
}
