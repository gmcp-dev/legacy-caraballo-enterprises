import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import './FarmDetail.css';

const API = 'http://localhost:3001/api';
const PROJECT_SLUG = 'granjas-eden';

const PERIODS = [
  { key: 'day', label: 'Hoy' },
  { key: 'week', label: 'Semana' },
  { key: 'month', label: 'Mes' },
  { key: 'all', label: 'Todo' },
];

const txTypeLabel = { entrada: 'Entrada', salida: 'Salida' };
const txTypeColor = { entrada: '#22c55e', salida: '#f87171' };

export default function FarmDetail() {
  const { farmSlug } = useParams();
  const [farm, setFarm] = useState(null);
  const [products, setProducts] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [showTxModal, setShowTxModal] = useState(false);
  const [txForm, setTxForm] = useState({ type: 'entrada', product_id: '', quantity: '', price: '', description: '' });
  const [period, setPeriod] = useState('all');
  const [editingField, setEditingField] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [productForm, setProductForm] = useState({ name: '', image: '', price: '' });
  const [members, setMembers] = useState([]);

  useEffect(() => {
    fetchFarm();
    fetchProducts();
  }, [farmSlug, period]);

  useEffect(() => {
    fetch(`${API}/members`).then(r => r.json()).then(d => {
      setMembers(Array.isArray(d) ? d.filter(m => m.status === 'active') : []);
    }).catch(() => setMembers([]));
  }, []);

  const fetchFarm = async () => {
    const res = await fetch(`${API}/projects/${PROJECT_SLUG}/farms/${farmSlug}?period=${period}`);
    const data = await res.json();
    setFarm(data);
  };

  const fetchProducts = async () => {
    const res = await fetch(`${API}/projects/${PROJECT_SLUG}/farms/${farmSlug}/products`);
    const data = await res.json();
    setProducts(Array.isArray(data) ? data : []);
  };

  const addTransaction = async (e) => {
    e.preventDefault();
    if (!txForm.quantity) return;
    await fetch(`${API}/projects/${PROJECT_SLUG}/farms/${farmSlug}/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: txForm.type,
        product_id: txForm.product_id ? parseInt(txForm.product_id) : null,
        quantity: parseFloat(txForm.quantity),
        price: txForm.price ? parseFloat(txForm.price) : undefined,
        description: txForm.description,
      }),
    });
    setTxForm({ type: 'entrada', product_id: '', quantity: '', price: '', description: '' });
    setShowTxModal(false);
    fetchFarm();
    fetchProducts();
  };

  const deleteTransaction = async (txId) => {
    if (!confirm('Eliminar transaccion?')) return;
    await fetch(`${API}/projects/${PROJECT_SLUG}/farms/${farmSlug}/transactions/${txId}`, { method: 'DELETE' });
    fetchFarm();
    fetchProducts();
  };

  const saveProduct = async (e) => {
    e.preventDefault();
    if (!productForm.name.trim()) return;
    if (editingProduct) {
      await fetch(`${API}/projects/${PROJECT_SLUG}/farms/${farmSlug}/products/${editingProduct.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: productForm.name, icon: productForm.image, price: parseFloat(productForm.price) || 0 }),
      });
    } else {
      await fetch(`${API}/projects/${PROJECT_SLUG}/farms/${farmSlug}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: productForm.name, icon: productForm.image, price: parseFloat(productForm.price) || 0 }),
      });
    }
    setShowProductModal(false);
    setEditingProduct(null);
    setProductForm({ name: '', image: '', price: '' });
    fetchProducts();
    fetchFarm();
  };

  const deleteProduct = async (productId) => {
    if (!confirm('Eliminar producto? Se perdera su inventario.')) return;
    await fetch(`${API}/projects/${PROJECT_SLUG}/farms/${farmSlug}/products/${productId}`, { method: 'DELETE' });
    fetchProducts();
    fetchFarm();
  };

  const openEditProduct = (p) => {
    setEditingProduct(p);
    setProductForm({ name: p.name, image: p.icon || '', price: p.price || '' });
    setShowProductModal(true);
  };

  const openNewProduct = () => {
    setEditingProduct(null);
    setProductForm({ name: '', image: '', price: '' });
    setShowProductModal(true);
  };

  const startEdit = (field, value) => {
    setEditingField(field);
    setEditForm({ [field]: value || '' });
  };

  const saveEdit = async () => {
    await fetch(`${API}/projects/${PROJECT_SLUG}/farms/${farmSlug}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    });
    setEditingField(null);
    fetchFarm();
  };

  const cancelEdit = () => {
    setEditingField(null);
    setEditForm({});
  };

  const formatMoney = (amount) => {
    return new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol' }).format(amount || 0);
  };

  const toggleStatus = async () => {
    const newStatus = farm.status === 'active' ? 'inactive' : 'active';
    await fetch(`${API}/projects/${PROJECT_SLUG}/farms/${farmSlug}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: farm.name, owner: farm.owner, status: newStatus }),
    });
    fetchFarm();
  };

  if (!farm) return null;

  const inventoryValue = (farm.inventory || []).reduce((sum, item) => sum + (item.quantity * (item.price || 0)), 0);

  return (
    <div>
      <Link to="/projects/granjas-eden" className="detail-back">← Volver a Granjas Eden</Link>

      <div className="fd-header">
        <div className="fd-header-left">
          <div>
            {editingField === 'name' ? (
              <div className="fd-edit-inline">
                <input
                  className="form-input"
                  value={editForm.name || ''}
                  onChange={(e) => setEditForm({ name: e.target.value })}
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                />
                <button className="btn btn-gold" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={saveEdit}>✓</button>
                <button className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={cancelEdit}>×</button>
              </div>
            ) : (
              <h1 className="page-title fd-title" onClick={() => startEdit('name', farm.name)}>
                {farm.name} ✎
              </h1>
            )}
            {editingField === 'owner' ? (
              <div className="fd-edit-inline">
                <select
                  className="form-input"
                  value={editForm.owner || ''}
                  onChange={(e) => setEditForm({ owner: e.target.value })}
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Escape') cancelEdit(); }}
                >
                  <option value="">Sin asignar</option>
                  {members.map(m => (
                    <option key={m.id} value={m.name}>{m.name}</option>
                  ))}
                </select>
                <button className="btn btn-gold" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={saveEdit}>✓</button>
                <button className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={cancelEdit}>×</button>
              </div>
            ) : (
              <p className="fd-owner" onClick={() => startEdit('owner', farm.owner)}>
                Propietario: {farm.owner || 'Sin asignar'} ✎
              </p>
            )}
          </div>
        </div>
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className={`badge badge-${farm.status}`}>
            {farm.status === 'active' ? 'Activa' : 'Inactiva'}
          </span>
          <button
            className={`btn ${farm.status === 'active' ? 'btn-outline' : 'btn-gold'}`}
            style={{ padding: '4px 12px', fontSize: '12px' }}
            onClick={toggleStatus}
          >
            {farm.status === 'active' ? 'Desactivar' : 'Activar'}
          </button>
        </span>
      </div>

      <div className="ge-period-filter">
        {PERIODS.map(p => (
          <button
            key={p.key}
            className={`btn ${period === p.key ? 'btn-gold' : 'btn-outline'}`}
            onClick={() => setPeriod(p.key)}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="detail-tabs">
        <button className={`detail-tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>Resumen</button>
        <button className={`detail-tab ${activeTab === 'inventory' ? 'active' : ''}`} onClick={() => setActiveTab('inventory')}>Inventario ({products.length})</button>
        <button className={`detail-tab ${activeTab === 'transactions' ? 'active' : ''}`} onClick={() => setActiveTab('transactions')}>Transacciones ({farm.transactions?.length || 0})</button>
      </div>

      {activeTab === 'overview' && (
        <div>
          <div className="grid grid-4" style={{ marginBottom: '32px' }}>
            <div className="stat-card">
              <div className="card-label">Entradas</div>
              <div className="stat-value" style={{ color: '#22c55e' }}>{formatMoney(farm.entradas)}</div>
            </div>
            <div className="stat-card">
              <div className="card-label">Salidas</div>
              <div className="stat-value" style={{ color: '#f87171' }}>{formatMoney(farm.salidas)}</div>
            </div>
            <div className="stat-card">
              <div className="card-label">Balance</div>
              <div className="stat-value" style={{ color: (farm.balance || 0) >= 0 ? 'var(--gold-primary)' : '#f87171' }}>
                {formatMoney(farm.balance)}
              </div>
            </div>
            <div className="stat-card">
              <div className="card-label">Valor Inventario</div>
              <div className="stat-value" style={{ color: 'var(--gold-primary)' }}>{formatMoney(inventoryValue)}</div>
            </div>
          </div>

          <h3 className="detail-section-title" style={{ marginBottom: '16px' }}>Productos</h3>
          {products.length === 0 ? (
            <div className="empty-state" style={{ padding: '24px' }}>
              <div className="empty-state-text">Sin productos. Agregalos en la pestana de Inventario.</div>
            </div>
          ) : (
            <div className="fd-inv-grid">
              {products.map(p => (
                <div key={p.id} className="fd-inv-card">
                  {p.icon ? <img src={p.icon} alt={p.name} className="fd-inv-img" /> : <span className="fd-inv-icon">📦</span>}
                  <span className="fd-inv-label">{p.name}</span>
                  <span className="fd-inv-qty" style={{ color: '#60a5fa' }}>{p.quantity || 0}</span>
                  <span className="fd-inv-price">{formatMoney(p.price)}/u</span>
                  <span className="fd-inv-value">{formatMoney((p.quantity || 0) * (p.price || 0))}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'inventory' && (
        <div>
          <div className="detail-section-header">
            <h3 className="detail-section-title">Productos</h3>
            <button className="btn btn-gold" onClick={openNewProduct}>+ Nuevo Producto</button>
          </div>
          {products.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">Sin productos</div>
              <div className="empty-state-text">Agrega productos para comenzar a gestionar el inventario</div>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th></th>
                    <th>Nombre</th>
                    <th style={{ textAlign: 'center' }}>Cantidad</th>
                    <th style={{ textAlign: 'center' }}>Precio Base</th>
                    <th style={{ textAlign: 'center' }}>Valor Total</th>
                    <th style={{ textAlign: 'center' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map(p => (
                    <tr key={p.id}>
                      <td>{p.icon ? <img src={p.icon} alt={p.name} style={{ width: '28px', height: '28px', borderRadius: '6px', objectFit: 'cover' }} /> : <span style={{ fontSize: '20px' }}>📦</span>}</td>
                      <td style={{ fontWeight: 600 }}>{p.name}</td>
                      <td style={{ textAlign: 'center', color: '#60a5fa', fontWeight: 600 }}>{p.quantity || 0}</td>
                      <td style={{ textAlign: 'center' }}>{formatMoney(p.price)}</td>
                      <td style={{ textAlign: 'center', fontWeight: 600 }}>{formatMoney((p.quantity || 0) * (p.price || 0))}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ display: 'inline-flex', gap: '4px' }}>
                          <button className="btn btn-outline" style={{ padding: '4px 10px', fontSize: '12px' }} onClick={() => openEditProduct(p)}>Editar</button>
                          <button className="project-delete-btn" onClick={() => deleteProduct(p.id)}>×</button>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'transactions' && (
        <div>
          <div className="detail-section-header">
            <h3 className="detail-section-title">Entradas y Salidas</h3>
            <button className="btn btn-gold" onClick={() => setShowTxModal(true)}>+ Nueva Transaccion</button>
          </div>
          {!farm.transactions || farm.transactions.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">Sin transacciones</div>
              <div className="empty-state-text">Registra entradas y salidas de la granja</div>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>Producto</th>
                    <th>Cantidad</th>
                    <th>Precio/u</th>
                    <th>Monto</th>
                    <th>Descripcion</th>
                    <th>Fecha</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {farm.transactions.map((tx) => (
                    <tr key={tx.id}>
                      <td>
                        <span className="tx-type-badge" style={{ color: txTypeColor[tx.type], borderColor: txTypeColor[tx.type] + '40', background: txTypeColor[tx.type] + '15' }}>
                          {txTypeLabel[tx.type]}
                        </span>
                      </td>
                      <td>{tx.product_name ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>{tx.product_icon ? <img src={tx.product_icon} alt="" style={{ width: '18px', height: '18px', borderRadius: '4px', objectFit: 'cover' }} /> : null}{tx.product_name}</span> : '—'}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{tx.quantity ?? '—'}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{tx.price ? formatMoney(tx.price) : '—'}</td>
                      <td style={{ color: txTypeColor[tx.type], fontWeight: 600 }}>{formatMoney(tx.amount)}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{tx.description || '—'}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{new Date(tx.date).toLocaleDateString('es-VE')}</td>
                      <td>
                        <button className="project-delete-btn" onClick={() => deleteTransaction(tx.id)}>×</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showTxModal && (
        <div className="modal-overlay" onClick={() => setShowTxModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Nueva Transaccion</h2>
              <button className="modal-close" onClick={() => setShowTxModal(false)}>×</button>
            </div>
            <form onSubmit={addTransaction}>
              <div className="form-group">
                <label className="form-label">Tipo</label>
                <div className="form-radio-group">
                  {[
                    { value: 'entrada', label: 'Entrada', color: '#22c55e' },
                    { value: 'salida', label: 'Salida', color: '#f87171' },
                  ].map((opt) => (
                    <label key={opt.value} className={`form-radio ${txForm.type === opt.value ? 'active' : ''}`} style={{ '--radio-color': opt.color }}>
                      <input type="radio" name="type" value={opt.value} checked={txForm.type === opt.value} onChange={(e) => setTxForm({ ...txForm, type: e.target.value })} />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Producto</label>
                <select className="form-input" value={txForm.product_id} onChange={(e) => {
                  const prod = products.find(p => p.id === parseInt(e.target.value));
                  setTxForm({ ...txForm, product_id: e.target.value, price: prod ? prod.price : '' });
                }}>
                  <option value="">Seleccionar producto...</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Cantidad</label>
                  <input type="number" className="form-input" placeholder="0" min="0" value={txForm.quantity} onChange={(e) => setTxForm({ ...txForm, quantity: e.target.value })} autoFocus />
                </div>
                <div className="form-group">
                  <label className="form-label">Precio/u ($)</label>
                  <input type="number" className="form-input" placeholder="0.00" min="0" step="0.01" value={txForm.price} onChange={(e) => setTxForm({ ...txForm, price: e.target.value })} />
                </div>
              </div>
              {txForm.quantity > 0 && txForm.price > 0 && (
                <div style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Monto total:</span>
                  <span style={{ color: 'var(--gold-primary)', fontWeight: 700, fontSize: '18px' }}>
                    {formatMoney(txForm.quantity * txForm.price)}
                  </span>
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Descripcion</label>
                <input type="text" className="form-input" placeholder="Descripcion opcional..." value={txForm.description} onChange={(e) => setTxForm({ ...txForm, description: e.target.value })} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowTxModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-gold" disabled={!txForm.quantity || txForm.quantity <= 0}>Registrar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showProductModal && (
        <div className="modal-overlay" onClick={() => { setShowProductModal(false); setEditingProduct(null); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editingProduct ? 'Editar Producto' : 'Nuevo Producto'}</h2>
              <button className="modal-close" onClick={() => { setShowProductModal(false); setEditingProduct(null); }}>×</button>
            </div>
            <form onSubmit={saveProduct}>
              <div className="form-group">
                <label className="form-label">Nombre</label>
                <input type="text" className="form-input" placeholder="Ej: Leche" value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} autoFocus />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Imagen (URL)</label>
                  <input type="url" className="form-input" placeholder="https://..." value={productForm.image} onChange={(e) => setProductForm({ ...productForm, image: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Precio Base ($)</label>
                  <input type="number" className="form-input" placeholder="0.00" min="0" step="0.01" value={productForm.price} onChange={(e) => setProductForm({ ...productForm, price: e.target.value })} />
                </div>
              </div>
              {productForm.image && (
                <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <img src={productForm.image} alt="Preview" style={{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.1)' }} onError={(e) => e.target.style.display = 'none'} />
                  <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Vista previa</span>
                </div>
              )}
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => { setShowProductModal(false); setEditingProduct(null); }}>Cancelar</button>
                <button type="submit" className="btn btn-gold">{editingProduct ? 'Guardar' : 'Crear'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
