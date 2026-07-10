import React from 'react';
import { Truck, MapPin, CheckCircle2, User } from 'lucide-react';

export default function DeliveryView({ orders, menuItems, updateOrderStatus, user }) {
  // Orders ready for delivery or currently out for delivery
  const readyOrders = orders.filter(order => order.status === 'Ready');
  const activeDeliveries = orders.filter(order => order.status === 'Out for Delivery');

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', padding: '12px' }}>
      
      {/* Column 1: Available Jobs */}
      <div>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '12px' }}>
          <Truck className="text-primary" /> Available Dispatch Queue
        </h3>
        
        {readyOrders.length === 0 ? (
          <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <p>No orders ready for delivery at the moment.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {readyOrders.map(order => (
              <div key={order.id} className="glass-panel" style={{ padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontWeight: 'bold' }}>Order #{order.id}</span>
                  <span className="badge badge-ready">Ready for pickup</span>
                </div>

                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <MapPin size={14} /> <span>Customer Address (Mock): 742 Evergreen Terrace</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <User size={14} /> <span>Customer ID: {order.user_id}</span>
                  </div>
                </div>

                <button 
                  className="btn btn-accent" 
                  style={{ width: '100%', fontSize: '0.9rem' }}
                  onClick={() => updateOrderStatus(order.id, 'Out for Delivery')}
                >
                  Accept & Dispatch
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Column 2: Active Deliveries */}
      <div>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '12px' }}>
          <MapPin className="text-primary" /> Active Delivery Jobs
        </h3>

        {activeDeliveries.length === 0 ? (
          <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <p>No active delivery tasks accepted.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {activeDeliveries.map(order => (
              <div key={order.id} className="glass-panel pulse-border" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontWeight: 'bold' }}>Delivery #{order.id}</span>
                  <span className="badge badge-ready" style={{ background: 'rgba(14,165,233,0.2)', color: 'var(--accent-secondary)' }}>Out for Delivery</span>
                </div>

                {/* Animated delivery route map simulation */}
                <div style={{
                  background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '8px',
                  position: 'relative', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  marginBottom: '16px', border: '1px dashed var(--glass-border)'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', zIndex: 10 }}>
                    <Truck size={20} className="text-primary" />
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Kitchen</span>
                  </div>
                  
                  {/* Dotted path connection */}
                  <div style={{
                    position: 'absolute', top: '35px', left: '40px', right: '40px', height: '2px',
                    borderTop: '2px dashed var(--accent-primary)', opacity: 0.6
                  }} />

                  {/* Pulsing bike node */}
                  <div className="pulse-border" style={{
                    position: 'absolute', left: '50%', transform: 'translateX(-50%)', top: '23px',
                    background: 'var(--accent-secondary)', width: '24px', height: '24px', borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <Truck size={12} color="white" />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', zIndex: 10 }}>
                    <MapPin size={20} style={{ color: 'var(--accent-success)' }} />
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Destination</span>
                  </div>
                </div>

                <button 
                  className="btn btn-success" 
                  style={{ width: '100%', fontSize: '0.9rem' }}
                  onClick={() => updateOrderStatus(order.id, 'Delivered')}
                >
                  <CheckCircle2 size={16} /> Mark as Delivered
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
