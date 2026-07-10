import React, { useState, useEffect } from 'react';
import { ShoppingCart, Compass, CreditCard, Clock, CheckCircle2, AlertCircle, Trash2, Heart } from 'lucide-react';

export default function CustomerView({ menuItems, orderHistory, placeOrder, wsStatus, user }) {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [cart, setCart] = useState([]);
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('Credit Card');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [activeTab, setActiveTab] = useState('browse'); // browse, track
  const [submittingOrder, setSubmittingOrder] = useState(false);

  // Filter menu items by category
  const categories = ['All', ...new Set(menuItems.map(item => item.category))];
  const filteredMenu = selectedCategory === 'All'
    ? menuItems
    : menuItems.filter(item => item.category === selectedCategory);

  // Cart logic
  const addToCart = (item) => {
    setCart(prevCart => {
      const existing = prevCart.find(cartItem => cartItem.id === item.id);
      if (existing) {
        return prevCart.map(cartItem =>
          cartItem.id === item.id ? { ...cartItem, quantity: cartItem.quantity + 1 } : cartItem
        );
      }
      return [...prevCart, { ...item, quantity: 1 }];
    });
  };

  const removeFromCart = (itemId) => {
    setCart(prevCart => prevCart.filter(item => item.id !== itemId));
  };

  const updateQuantity = (itemId, change) => {
    setCart(prevCart => prevCart.map(item => {
      if (item.id === itemId) {
        const newQty = item.quantity + change;
        return newQty > 0 ? { ...item, quantity: newQty } : item;
      }
      return item;
    }));
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const handleCheckoutSubmit = async (e) => {
    e.preventDefault();
    if (cart.length === 0) return;
    setSubmittingOrder(true);

    const orderPayload = {
      user_id: user?.id || 99, // default guest user
      total_amount: Math.round(cartTotal * 100) / 100,
      items: cart.map(item => ({
        food_id: item.id,
        quantity: item.quantity,
        price: item.price
      }))
    };

    try {
      await placeOrder(orderPayload);
      setCart([]);
      setCheckoutModalOpen(false);
      setActiveTab('track');
    } catch (err) {
      console.error('Checkout failed:', err);
    } finally {
      setSubmittingOrder(false);
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'Pending': return 'badge-pending';
      case 'Paid': return 'badge-paid';
      case 'Preparing': return 'badge-preparing';
      case 'Ready': return 'badge-ready';
      case 'Out for Delivery': return 'badge-ready';
      case 'Delivered': return 'badge-delivered';
      case 'Payment Failed': return 'badge-failed';
      default: return 'badge-pending';
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: activeTab === 'browse' ? '1fr 350px' : '1fr', gap: '24px' }}>
      
      {/* Left Column: Browse or Track */}
      <div>
        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
          <button 
            className={`btn ${activeTab === 'browse' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('browse')}
          >
            <Compass size={18} /> Browse Menu
          </button>
          <button 
            className={`btn ${activeTab === 'track' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('track')}
            style={{ position: 'relative' }}
          >
            <Clock size={18} /> Live Order Tracking
            {orderHistory.filter(o => o.status !== 'Delivered' && o.status !== 'Payment Failed').length > 0 && (
              <span style={{
                position: 'absolute', top: -6, right: -6, background: 'var(--accent-danger)',
                color: 'white', fontSize: '0.7rem', width: '18px', height: '18px',
                borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold'
              }}>
                {orderHistory.filter(o => o.status !== 'Delivered' && o.status !== 'Payment Failed').length}
              </span>
            )}
          </button>
        </div>

        {activeTab === 'browse' ? (
          <div>
            {/* Category filter */}
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '12px', marginBottom: '20px' }}>
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  style={{
                    padding: '8px 16px', borderRadius: '20px', border: '1px solid var(--glass-border)',
                    background: selectedCategory === cat ? 'var(--accent-primary)' : 'var(--glass-bg)',
                    color: selectedCategory === cat ? 'white' : 'var(--text-secondary)',
                    cursor: 'pointer', transition: 'var(--transition-smooth)', fontWeight: 'bold', fontSize: '0.85rem'
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Menu Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '20px' }}>
              {filteredMenu.map(item => (
                <div key={item.id} className="glass-panel glass-card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <div style={{ height: '160px', overflow: 'hidden', position: 'relative' }}>
                    <img src={item.image_url} alt={item.food_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <span className="glass-panel" style={{
                      position: 'absolute', top: 12, right: 12, padding: '4px 10px', borderRadius: '12px',
                      fontWeight: 'bold', fontSize: '0.9rem', color: '#fff', background: 'rgba(10,11,16,0.7)'
                    }}>
                      ${item.price.toFixed(2)}
                    </span>
                  </div>
                  
                  <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', flexGrow: 1, justifyContent: 'space-between' }}>
                    <div>
                      <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--accent-secondary)', fontWeight: 'bold' }}>{item.category}</span>
                      <h4 style={{ margin: '4px 0 12px 0', fontSize: '1.1rem' }}>{item.food_name}</h4>
                    </div>

                    <button 
                      className="btn btn-secondary" 
                      style={{ width: '100%', fontSize: '0.85rem' }}
                      onClick={() => addToCart(item)}
                      disabled={!item.availability}
                    >
                      {item.availability ? 'Add to Cart' : 'Out of Stock'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Live Tracking Sub-view */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h3 style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '12px' }}>Your Orders</h3>
            
            {orderHistory.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                <Clock size={48} style={{ marginBottom: '12px', opacity: 0.5 }} />
                <p>No orders placed yet.</p>
              </div>
            ) : (
              orderHistory.map(order => (
                <div key={order.id} className="glass-panel" style={{ padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div>
                      <h4 style={{ fontSize: '1.1rem' }}>Order #{order.id}</h4>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {new Date(order.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                    <div>
                      <span className={`badge ${getStatusBadgeClass(order.status)}`}>{order.status}</span>
                    </div>
                  </div>

                  {/* Progress Tracker Bar */}
                  {order.status !== 'Payment Failed' && (
                    <div style={{ marginBottom: '24px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                        <span style={{ color: order.status !== 'Pending' ? 'var(--accent-success)' : 'inherit', fontWeight: 'bold' }}>1. Placed</span>
                        <span style={{ color: ['Paid', 'Preparing', 'Ready', 'Out for Delivery', 'Delivered'].includes(order.status) ? 'var(--accent-success)' : 'inherit', fontWeight: 'bold' }}>2. Paid</span>
                        <span style={{ color: ['Preparing', 'Ready', 'Out for Delivery', 'Delivered'].includes(order.status) ? 'var(--accent-success)' : 'inherit', fontWeight: 'bold' }}>3. Preparing</span>
                        <span style={{ color: ['Ready', 'Out for Delivery', 'Delivered'].includes(order.status) ? 'var(--accent-success)' : 'inherit', fontWeight: 'bold' }}>4. Ready</span>
                        <span style={{ color: ['Out for Delivery', 'Delivered'].includes(order.status) ? 'var(--accent-success)' : 'inherit', fontWeight: 'bold' }}>5. Dispatched</span>
                        <span style={{ color: order.status === 'Delivered' ? 'var(--accent-success)' : 'inherit', fontWeight: 'bold' }}>6. Delivered</span>
                      </div>
                      <div style={{ height: '6px', background: 'var(--bg-tertiary)', borderRadius: '3px', overflow: 'hidden', display: 'flex' }}>
                        <div style={{
                          height: '100%',
                          background: order.status === 'Delivered' ? 'var(--accent-success)' : 'var(--accent-primary)',
                          width: order.status === 'Pending' ? '16.6%' : 
                                 order.status === 'Paid' ? '33.3%' :
                                 order.status === 'Preparing' ? '50%' :
                                 order.status === 'Ready' ? '66.6%' :
                                 order.status === 'Out for Delivery' ? '83.3%' : '100%',
                          transition: 'width 0.8s ease-in-out'
                        }} />
                      </div>
                    </div>
                  )}

                  {/* Order items lists */}
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', marginBottom: '12px' }}>
                    {order.items && order.items.map(item => {
                      const food = menuItems.find(m => m.id === item.food_id);
                      return (
                        <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '6px' }}>
                          <span>{food ? food.food_name : `Food Item #${item.food_id}`} <strong style={{ color: 'var(--accent-primary)' }}>x{item.quantity}</strong></span>
                          <span>${(item.price * item.quantity).toFixed(2)}</span>
                        </div>
                      );
                    })}
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--glass-border)', paddingTop: '8px', marginTop: '8px', fontWeight: 'bold' }}>
                      <span>Total Amount Paid</span>
                      <span>${order.total_amount.toFixed(2)}</span>
                    </div>
                  </div>
                  
                  {order.status === 'Pending' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      <span className="pulse-border" style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--accent-warning)', display: 'inline-block' }} />
                      <span>Simulating payment processing via RabbitMQ microservice broker...</span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Right Column: Checkout Cart (Only shown in browse tab) */}
      {activeTab === 'browse' && (
        <div className="glass-panel" style={{ padding: '24px', height: 'fit-content', position: 'sticky', top: '100px' }}>
          <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShoppingCart /> Cart
          </h3>
          
          {cart.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-secondary)' }}>
              <p>Your cart is empty.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ maxHeight: '280px', overflowY: 'auto', paddingRight: '4px' }}>
                {cart.map(item => (
                  <div key={item.id} style={{ display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '12px' }}>
                    <img src={item.image_url} alt={item.food_name} style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '6px' }} />
                    <div style={{ flexGrow: 1 }}>
                      <h5 style={{ fontSize: '0.9rem', marginBottom: '2px' }}>{item.food_name}</h5>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>${item.price.toFixed(2)}</span>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                        <button onClick={() => updateQuantity(item.id, -1)} style={{ width: '22px', height: '22px', border: '1px solid var(--glass-border)', background: 'none', color: 'white', borderRadius: '50%', cursor: 'pointer' }}>-</button>
                        <span style={{ fontSize: '0.85rem' }}>{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.id, 1)} style={{ width: '22px', height: '22px', border: '1px solid var(--glass-border)', background: 'none', color: 'white', borderRadius: '50%', cursor: 'pointer' }}>+</button>
                      </div>
                    </div>
                    <button onClick={() => removeFromCart(item.id)} style={{ background: 'none', border: 'none', color: 'var(--accent-danger)', cursor: 'pointer', height: 'fit-content' }}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>

              <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', marginBottom: '16px' }}>
                  <span>Total:</span>
                  <span>${cartTotal.toFixed(2)}</span>
                </div>
                
                <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => setCheckoutModalOpen(true)}>
                  Proceed to Checkout
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Checkout Modal */}
      {checkoutModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200
        }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '450px', padding: '32px', position: 'relative' }}>
            <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CreditCard className="text-primary" /> Mock Payments
            </h3>

            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
              <h5 style={{ marginBottom: '8px', color: 'var(--text-secondary)' }}>Payment Summary</h5>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                <span>Order Total:</span>
                <span>${cartTotal.toFixed(2)}</span>
              </div>
            </div>

            <form onSubmit={handleCheckoutSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Payment Method</label>
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                  <option value="Credit Card">Credit Card (Simulated)</option>
                  <option value="PayPal">PayPal Mock</option>
                  <option value="Cash on Delivery">Cash on Delivery (Manual)</option>
                </select>
              </div>

              {paymentMethod === 'Credit Card' && (
                <>
                  <div>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Card Number</label>
                    <input type="text" placeholder="4111 2222 3333 4444" value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} required />
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>* Enter 999 in total price for simulated failure testing</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Expiry</label>
                      <input type="text" placeholder="MM/YY" value={cardExpiry} onChange={(e) => setCardExpiry(e.target.value)} required />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>CVV</label>
                      <input type="text" placeholder="123" value={cardCvv} onChange={(e) => setCardCvv(e.target.value)} required />
                    </div>
                  </div>
                </>
              )}

              <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setCheckoutModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={submittingOrder}>
                  {submittingOrder ? 'Placing Order...' : 'Pay & Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
