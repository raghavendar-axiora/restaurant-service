import React from 'react';
import { ChefHat, Play, CheckCircle } from 'lucide-react';

export default function ChefView({ orders, menuItems, updateOrderStatus }) {
  // Chef handles Paid (needs prep) and Preparing (currently cooking) orders
  const activeChefOrders = orders.filter(order => ['Paid', 'Preparing'].includes(order.status));

  return (
    <div style={{ padding: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '16px' }}>
        <ChefHat size={32} className="text-primary" />
        <div>
          <h2>Kitchen Display System (KDS)</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Real-time updates for cooking staff. Pulls orders from order-service queue.</p>
        </div>
      </div>

      {activeChefOrders.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' }}>
          <ChefHat size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
          <h3>All caught up!</h3>
          <p style={{ fontSize: '0.9rem', marginTop: '6px' }}>No orders currently require preparation.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
          {activeChefOrders.map(order => (
            <div key={order.id} className="glass-panel pulse-border" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '260px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>Order #{order.id}</span>
                  <span className={`badge ${order.status === 'Paid' ? 'badge-paid' : 'badge-preparing'}`}>
                    {order.status === 'Paid' ? 'New (Paid)' : 'Preparing'}
                  </span>
                </div>
                
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '12px' }}>
                  Received: {new Date(order.created_at).toLocaleTimeString()}
                </span>

                {/* Items List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--glass-border)', borderBottom: '1px solid var(--glass-border)', padding: '12px 0', marginBottom: '16px' }}>
                  {order.items && order.items.map(item => {
                    const dish = menuItems.find(m => m.id === item.food_id);
                    return (
                      <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem' }}>
                        <span>
                          <strong style={{ color: 'var(--accent-secondary)' }}>{item.quantity}x</strong> {dish ? dish.food_name : `Dish #${item.food_id}`}
                        </span>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{dish?.category}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Buttons */}
              <div>
                {order.status === 'Paid' ? (
                  <button 
                    className="btn btn-primary" 
                    style={{ width: '100%' }}
                    onClick={() => updateOrderStatus(order.id, 'Preparing')}
                  >
                    <Play size={16} /> Start Cooking
                  </button>
                ) : (
                  <button 
                    className="btn btn-success" 
                    style={{ width: '100%' }}
                    onClick={() => updateOrderStatus(order.id, 'Ready')}
                  >
                    <CheckCircle size={16} /> Mark Ready for Pickup
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
