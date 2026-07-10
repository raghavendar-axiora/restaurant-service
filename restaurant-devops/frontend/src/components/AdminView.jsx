import React, { useState, useEffect } from 'react';
import { Settings, BarChart2, PlusCircle, Trash, RefreshCw, Layers, ShieldCheck, CheckCircle2, XCircle } from 'lucide-react';

export default function AdminView({ menuItems, apiBaseUrl, isMockMode, onMenuChange }) {
  const [activeSubTab, setActiveSubTab] = useState('dashboard'); // dashboard, menu, users
  
  // Dashboard states
  const [dashboardStats, setDashboardStats] = useState({
    totalOrders: 0,
    totalRevenue: 0.00,
    uniqueCustomers: 0,
    itemsPerformance: []
  });
  const [loadingStats, setLoadingStats] = useState(false);
  
  // Menu management states
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newCategory, setNewCategory] = useState('Burgers');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [addingItem, setAddingItem] = useState(false);

  // Users list state
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Fetch report data
  const fetchDashboardStats = async () => {
    setLoadingStats(true);
    if (isMockMode) {
      // Simulate dashboard aggregation from menu items
      setTimeout(() => {
        setDashboardStats({
          totalOrders: 14,
          totalRevenue: 285.50,
          uniqueCustomers: 6,
          itemsPerformance: [
            { food_id: 1, salesCount: 5, revenue: 94.95 },
            { food_id: 2, salesCount: 4, revenue: 58.00 },
            { food_id: 3, salesCount: 3, revenue: 36.00 },
            { food_id: 5, salesCount: 2, revenue: 32.00 }
          ]
        });
        setLoadingStats(false);
      }, 500);
      return;
    }

    try {
      const res = await fetch(`${apiBaseUrl}/api/reports/dashboard`);
      const data = await res.json();
      if (res.ok) {
        setDashboardStats(data);
      }
    } catch (e) {
      console.error('Failed to load dashboard report:', e);
    } finally {
      setLoadingStats(false);
    }
  };

  // Fetch Users
  const fetchUsers = async () => {
    setLoadingUsers(true);
    if (isMockMode) {
      setTimeout(() => {
        setUsers([
          { id: 1, name: 'Admin Manager', email: 'admin@restaurant.com', role: 'admin', phone: '111-222-3333' },
          { id: 2, name: 'Chef Mario', email: 'chef@restaurant.com', role: 'chef', phone: '222-333-4444' },
          { id: 3, name: 'Delivery Dan', email: 'delivery@restaurant.com', role: 'delivery', phone: '333-444-5555' },
          { id: 4, name: 'Alice Customer', email: 'alice@gmail.com', role: 'customer', phone: '444-555-6666' }
        ]);
        setLoadingUsers(false);
      }, 500);
      return;
    }

    try {
      const res = await fetch(`${apiBaseUrl}/api/auth/users`);
      const data = await res.json();
      if (res.ok) {
        setUsers(data);
      }
    } catch (e) {
      console.error('Failed to load users list:', e);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'dashboard') {
      fetchDashboardStats();
    } else if (activeSubTab === 'users') {
      fetchUsers();
    }
  }, [activeSubTab, menuItems]);

  // Handle Add Item
  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!newName || !newPrice) return;
    setAddingItem(true);

    const payload = {
      food_name: newName,
      price: parseFloat(newPrice),
      category: newCategory,
      availability: true,
      image_url: newImageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=500&q=80'
    };

    if (isMockMode) {
      const newItem = {
        id: menuItems.length > 0 ? Math.max(...menuItems.map(m => m.id)) + 1 : 1,
        ...payload
      };
      onMenuChange([...menuItems, newItem]);
      resetForm();
      return;
    }

    try {
      const res = await fetch(`${apiBaseUrl}/api/menu`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        onMenuChange([...menuItems, data]);
        resetForm();
      }
    } catch (err) {
      console.error('Failed to add dish:', err);
    }
  };

  const resetForm = () => {
    setNewName('');
    setNewPrice('');
    setNewImageUrl('');
    setAddingItem(false);
  };

  // Handle Toggle Availability
  const toggleAvailability = async (item) => {
    const updated = { ...item, availability: !item.availability };
    
    if (isMockMode) {
      onMenuChange(menuItems.map(m => m.id === item.id ? updated : m));
      return;
    }

    try {
      const res = await fetch(`${apiBaseUrl}/api/menu/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      if (res.ok) {
        onMenuChange(menuItems.map(m => m.id === item.id ? updated : m));
      }
    } catch (err) {
      console.error('Failed to toggle availability:', err);
    }
  };

  // Handle Delete Item
  const handleDeleteItem = async (itemId) => {
    if (!window.confirm('Are you sure you want to delete this menu item?')) return;

    if (isMockMode) {
      onMenuChange(menuItems.filter(m => m.id !== itemId));
      return;
    }

    try {
      const res = await fetch(`${apiBaseUrl}/api/menu/${itemId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        onMenuChange(menuItems.filter(m => m.id !== itemId));
      }
    } catch (err) {
      console.error('Failed to delete item:', err);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '24px' }}>
      
      {/* Sidebar navigation */}
      <div className="glass-panel" style={{ padding: '16px', height: 'fit-content' }}>
        <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', color: 'var(--text-secondary)' }}>
          <Settings size={18} /> Management
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button 
            className={`btn ${activeSubTab === 'dashboard' ? 'btn-primary' : 'btn-secondary'}`} 
            style={{ justifyContent: 'flex-start', padding: '10px 16px', fontSize: '0.85rem' }}
            onClick={() => setActiveSubTab('dashboard')}
          >
            <BarChart2 size={16} /> Sales Report
          </button>
          
          <button 
            className={`btn ${activeSubTab === 'menu' ? 'btn-primary' : 'btn-secondary'}`} 
            style={{ justifyContent: 'flex-start', padding: '10px 16px', fontSize: '0.85rem' }}
            onClick={() => setActiveSubTab('menu')}
          >
            <Layers size={16} /> Manage Menu
          </button>

          <button 
            className={`btn ${activeSubTab === 'users' ? 'btn-primary' : 'btn-secondary'}`} 
            style={{ justifyContent: 'flex-start', padding: '10px 16px', fontSize: '0.85rem' }}
            onClick={() => setActiveSubTab('users')}
          >
            <ShieldCheck size={16} /> Manage Staff
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div>
        {activeSubTab === 'dashboard' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3>Sales Dashboard & Reports</h3>
              <button className="btn btn-secondary" onClick={fetchDashboardStats} disabled={loadingStats}>
                <RefreshCw size={14} className={loadingStats ? 'spin' : ''} /> Refresh
              </button>
            </div>

            {loadingStats ? (
              <p>Aggregating records via microservice gateway...</p>
            ) : (
              <div>
                {/* Aggregated KPI Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '32px' }}>
                  <div className="glass-panel" style={{ padding: '24px', textAlign: 'center' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Total Revenue (Paid)</span>
                    <h2 style={{ fontSize: '2rem', color: 'var(--accent-success)', marginTop: '8px' }}>
                      ${dashboardStats.totalRevenue.toFixed(2)}
                    </h2>
                  </div>
                  <div className="glass-panel" style={{ padding: '24px', textAlign: 'center' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Orders Handled</span>
                    <h2 style={{ fontSize: '2rem', color: 'var(--accent-primary)', marginTop: '8px' }}>
                      {dashboardStats.totalOrders}
                    </h2>
                  </div>
                  <div className="glass-panel" style={{ padding: '24px', textAlign: 'center' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Unique Customers</span>
                    <h2 style={{ fontSize: '2rem', color: 'var(--accent-secondary)', marginTop: '8px' }}>
                      {dashboardStats.uniqueCustomers}
                    </h2>
                  </div>
                </div>

                {/* Items Performance Table */}
                <h4 style={{ marginBottom: '12px' }}>Food Sales Breakdowns</h4>
                <div className="glass-panel" style={{ padding: '16px', overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--text-secondary)' }}>
                        <th style={{ padding: '12px 8px' }}>Dish Name</th>
                        <th style={{ padding: '12px 8px' }}>Category</th>
                        <th style={{ padding: '12px 8px' }}>Portions Sold</th>
                        <th style={{ padding: '12px 8px' }}>Total Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {menuItems.map(item => {
                        const perf = dashboardStats.itemsPerformance.find(p => p.food_id === item.id) || { salesCount: 0, revenue: 0 };
                        return (
                          <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                            <td style={{ padding: '12px 8px', fontWeight: 'bold' }}>{item.food_name}</td>
                            <td style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>{item.category}</td>
                            <td style={{ padding: '12px 8px', color: 'var(--accent-primary)', fontWeight: 'bold' }}>{perf.salesCount}</td>
                            <td style={{ padding: '12px 8px', color: 'var(--accent-success)', fontWeight: 'bold' }}>${perf.revenue.toFixed(2)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {activeSubTab === 'menu' && (
          <div>
            <h3>Menu CRUD & Stock Controls</h3>
            
            {/* Form to Add Dish */}
            <form onSubmit={handleAddItem} className="glass-panel" style={{ padding: '24px', margin: '20px 0 32px 0' }}>
              <h4 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <PlusCircle className="text-primary" size={18} /> Add New Food Item
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.5fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Food Name</label>
                  <input type="text" placeholder="Gourmet Taco" value={newName} onChange={(e) => setNewName(e.target.value)} required />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Price ($)</label>
                  <input type="number" step="0.01" placeholder="9.99" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} required />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Category</label>
                  <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)}>
                    <option value="Burgers">Burgers</option>
                    <option value="Pizzas">Pizzas</option>
                    <option value="Salads">Salads</option>
                    <option value="Desserts">Desserts</option>
                    <option value="Main Course">Main Course</option>
                    <option value="Beverages">Beverages</option>
                  </select>
                </div>
              </div>
              
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Image URL</label>
                <input type="text" placeholder="https://images.unsplash.com/..." value={newImageUrl} onChange={(e) => setNewImageUrl(e.target.value)} />
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button type="submit" className="btn btn-primary" disabled={addingItem}>
                  {addingItem ? 'Saving...' : 'Add Food Item'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={resetForm}>Cancel</button>
              </div>
            </form>

            {/* List of Dishes */}
            <h4 style={{ marginBottom: '12px' }}>Current Menu Items</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {menuItems.map(item => (
                <div key={item.id} className="glass-panel" style={{ padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <img src={item.image_url} alt={item.food_name} style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '8px' }} />
                    <div>
                      <h5 style={{ fontSize: '1rem', margin: '0' }}>{item.food_name}</h5>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{item.category} • ${item.price.toFixed(2)}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    {/* Toggle Availability Switch */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Available:</span>
                      <button 
                        type="button" 
                        onClick={() => toggleAvailability(item)}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: item.availability ? 'var(--accent-success)' : 'var(--accent-danger)'
                        }}
                      >
                        {item.availability ? <CheckCircle2 size={22} /> : <XCircle size={22} />}
                      </button>
                    </div>

                    <button className="btn btn-danger" style={{ padding: '8px 12px' }} onClick={() => handleDeleteItem(item.id)}>
                      <Trash size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeSubTab === 'users' && (
          <div>
            <h3>Staff & User Registry</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '20px' }}>
              Registered system users. Loaded directly from auth-service.
            </p>

            {loadingUsers ? (
              <p>Connecting to authentication database...</p>
            ) : (
              <div className="glass-panel" style={{ padding: '20px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--text-secondary)' }}>
                      <th style={{ padding: '12px 8px' }}>ID</th>
                      <th style={{ padding: '12px 8px' }}>Name</th>
                      <th style={{ padding: '12px 8px' }}>Email</th>
                      <th style={{ padding: '12px 8px' }}>Role</th>
                      <th style={{ padding: '12px 8px' }}>Phone</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: '12px 8px' }}>{u.id}</td>
                        <td style={{ padding: '12px 8px', fontWeight: 'bold' }}>{u.name}</td>
                        <td style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>{u.email}</td>
                        <td style={{ padding: '12px 8px' }}>
                          <span style={{
                            padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase',
                            background: u.role === 'admin' ? 'rgba(239, 68, 68, 0.2)' : u.role === 'chef' ? 'rgba(99, 102, 241, 0.2)' : u.role === 'delivery' ? 'rgba(14, 165, 233, 0.2)' : 'rgba(255,255,255,0.05)',
                            color: u.role === 'admin' ? 'var(--accent-danger)' : u.role === 'chef' ? 'var(--accent-primary)' : u.role === 'delivery' ? 'var(--accent-secondary)' : 'var(--text-secondary)'
                          }}>
                            {u.role}
                          </span>
                        </td>
                        <td style={{ padding: '12px 8px', color: 'var(--text-muted)' }}>{u.phone || 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
