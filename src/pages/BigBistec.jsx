import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import './BigBistec.css';

const API = '/api';
const SLUG = 'big-bistec';

function memberSlug(name) {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '').replace(/--+/g, '-');
}

export default function BigBistec() {
  const [project, setProject] = useState(null);
  const [inventory, setInventory] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [allMembers, setAllMembers] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [sales, setSales] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [_transactions, setTransactions] = useState([]);
  const [stats, setStats] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [productForm, setProductForm] = useState({ name: '', cost_price: '', selling_price: '' });

  const [showEntradaModal, setShowEntradaModal] = useState(false);
  const [entradaForm, setEntradaForm] = useState({ product_id: '', quantity: '', price: '', description: '' });

  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [deliveryForm, setDeliveryForm] = useState({ member_id: '', product_id: '', quantity: '', assigned_price: '', description: '' });

  const [showSaleModal, setShowSaleModal] = useState(false);
  const [saleForm, setSaleForm] = useState({ delivery_id: '', quantity_sold: '', description: '' });

  const [showSettlementModal, setShowSettlementModal] = useState(false);
  const [settlementForm, setSettlementForm] = useState({ delivery_id: '', quantity_returned: '', description: '' });

  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [addEmployeeId, setAddEmployeeId] = useState('');

  const fetchAll = useCallback(async () => {
    const [p, inv, emp, del, sl, stl, tx, st, members] = await Promise.all([
      fetch(`${API}/projects/${SLUG}`).then(r => r.json()),
      fetch(`${API}/projects/${SLUG}/inventory`).then(r => r.json()),
      fetch(`${API}/projects/${SLUG}/employees`).then(r => r.json()),
      fetch(`${API}/projects/${SLUG}/deliveries`).then(r => r.json()),
      fetch(`${API}/projects/${SLUG}/sales`).then(r => r.json()),
      fetch(`${API}/projects/${SLUG}/settlements`).then(r => r.json()),
      fetch(`${API}/projects/${SLUG}/transactions`).then(r => r.json()),
      fetch(`${API}/projects/${SLUG}/stats`).then(r => r.json()),
      fetch(`${API}/members`).then(r => r.json()),
    ]);
    setProject(p);
    setInventory(Array.isArray(inv) ? inv : []);
    setEmployees(Array.isArray(emp) ? emp : []);
    setDeliveries(Array.isArray(del) ? del : []);
    setSales(Array.isArray(sl) ? sl : []);
    setSettlements(Array.isArray(stl) ? stl : []);
    setTransactions(Array.isArray(tx) ? tx : []);
    setStats(st);
    setAllMembers(Array.isArray(members) ? members.filter(m => m.status === 'active') : []);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const formatMoney = (amount) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol' }).format(amount || 0);
  };

  const createProduct = async (e) => {
    e.preventDefault();
    if (!productForm.name) return;
    const url = editingProduct
      ? `${API}/projects/${SLUG}/products/${editingProduct.id}`
      : `${API}/projects/${SLUG}/products`;
    await fetch(url, {
      method: editingProduct ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: productForm.name,
        cost_price: parseFloat(productForm.cost_price) || 0,
        selling_price: parseFloat(productForm.selling_price) || 0,
      }),
    });
    setProductForm({ name: '', cost_price: '', selling_price: '' });
    setEditingProduct(null);
    setShowProductModal(false);
    fetchAll();
  };

  const deleteProduct = async (id) => {
    if (!confirm('Eliminar producto? Se eliminaran tambien su inventario y registros asociados.')) return;
    await fetch(`${API}/projects/${SLUG}/products/${id}`, { method: 'DELETE' });
    fetchAll();
  };

  const startEditProduct = (product) => {
    setEditingProduct(product);
    setProductForm({ name: product.name, cost_price: product.cost_price || '', selling_price: product.selling_price || '' });
    setShowProductModal(true);
  };

  const addEntrada = async (e) => {
    e.preventDefault();
    if (!entradaForm.product_id || !entradaForm.quantity) return;
    await fetch(`${API}/projects/${SLUG}/inventory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_id: parseInt(entradaForm.product_id),
        quantity: parseFloat(entradaForm.quantity),
        price: entradaForm.price ? parseFloat(entradaForm.price) : undefined,
        description: entradaForm.description,
      }),
    });
    setEntradaForm({ product_id: '', quantity: '', price: '', description: '' });
    setShowEntradaModal(false);
    fetchAll();
  };

  const addDelivery = async (e) => {
    e.preventDefault();
    if (!deliveryForm.member_id || !deliveryForm.product_id || !deliveryForm.quantity) return;
    const res = await fetch(`${API}/projects/${SLUG}/deliveries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        member_id: parseInt(deliveryForm.member_id),
        product_id: parseInt(deliveryForm.product_id),
        quantity: parseFloat(deliveryForm.quantity),
        assigned_price: deliveryForm.assigned_price ? parseFloat(deliveryForm.assigned_price) : undefined,
        description: deliveryForm.description,
      }),
    });
    const data = await res.json();
    if (data.error) { alert(data.error); return; }
    setDeliveryForm({ member_id: '', product_id: '', quantity: '', assigned_price: '', description: '' });
    setShowDeliveryModal(false);
    fetchAll();
  };

  const deleteDelivery = async (id) => {
    if (!confirm('Eliminar entrega? Se revertiran las ventas y devoluciones asociadas.')) return;
    await fetch(`${API}/projects/${SLUG}/deliveries/${id}`, { method: 'DELETE' });
    fetchAll();
  };

  const addSale = async (e) => {
    e.preventDefault();
    if (!saleForm.delivery_id || !saleForm.quantity_sold) return;
    const res = await fetch(`${API}/projects/${SLUG}/sales`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        delivery_id: parseInt(saleForm.delivery_id),
        quantity_sold: parseFloat(saleForm.quantity_sold),
        description: saleForm.description,
      }),
    });
    const data = await res.json();
    if (data.error) { alert(data.error); return; }
    setSaleForm({ delivery_id: '', quantity_sold: '', description: '' });
    setShowSaleModal(false);
    fetchAll();
  };

  const deleteSale = async (id) => {
    if (!confirm('Eliminar venta? Se revertira el ingreso en tesoreria.')) return;
    await fetch(`${API}/projects/${SLUG}/sales/${id}`, { method: 'DELETE' });
    fetchAll();
  };

  const addSettlement = async (e) => {
    e.preventDefault();
    if (!settlementForm.delivery_id) return;
    const res = await fetch(`${API}/projects/${SLUG}/settlements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        delivery_id: parseInt(settlementForm.delivery_id),
        quantity_returned: parseFloat(settlementForm.quantity_returned) || 0,
        description: settlementForm.description,
      }),
    });
    const data = await res.json();
    if (data.error) { alert(data.error); return; }
    setSettlementForm({ delivery_id: '', quantity_returned: '', description: '' });
    setShowSettlementModal(false);
    fetchAll();
  };

  const _deleteSettlement = async (id) => {
    if (!confirm('Eliminar liquidacion? Se revertiran los cambios en inventario.')) return;
    await fetch(`${API}/projects/${SLUG}/settlements/${id}`, { method: 'DELETE' });
    fetchAll();
  };

  const addEmployee = async () => {
    if (!addEmployeeId) return;
    const newIds = [...employees.map(e => e.id), parseInt(addEmployeeId)];
    await fetch(`${API}/projects/${SLUG}/employees`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberIds: newIds }),
    });
    setAddEmployeeId('');
    setShowAddEmployee(false);
    fetchAll();
  };

  const removeEmployee = async (memberId) => {
    if (!confirm('Remover miembro del proyecto?')) return;
    const newIds = employees.filter(e => e.id !== memberId).map(e => e.id);
    await fetch(`${API}/projects/${SLUG}/employees`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberIds: newIds }),
    });
    fetchAll();
  };

  const pendingDeliveries = deliveries.filter(d => d.status === 'pending');
  const availableMembers = allMembers.filter(m => !employees.some(e => e.id === m.id));

  if (!project) return null;

  return (
    <div>
      <Link to="/finanzas" className="detail-back">← Finanzas</Link>

      <div className="bb-header">
        <div>
          <h1 className="page-title">{project.name}</h1>
          <p className="page-subtitle">{project.description || 'Sin descripcion'}</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-outline" onClick={() => { setShowEntradaModal(true); setEntradaForm({ product_id: inventory[0]?.id || '', quantity: '', price: '', description: '' }); }}>+ Entrada</button>
          <button className="btn btn-outline" onClick={() => { setShowDeliveryModal(true); setDeliveryForm({ member_id: employees[0]?.id || '', product_id: inventory[0]?.id || '', quantity: '', assigned_price: '', description: '' }); }}>+ Entrega</button>
          <button className="btn btn-gold" onClick={() => { setShowProductModal(true); setEditingProduct(null); setProductForm({ name: '', cost_price: '', selling_price: '' }); }}>+ Producto</button>
        </div>
      </div>

      <div className="detail-tabs">
        <button className={`detail-tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>Resumen</button>
        <button className={`detail-tab ${activeTab === 'inventory' ? 'active' : ''}`} onClick={() => setActiveTab('inventory')}>Inventario ({inventory.length})</button>
        <button className={`detail-tab ${activeTab === 'employees' ? 'active' : ''}`} onClick={() => setActiveTab('employees')}>Empleados ({employees.length})</button>
        <button className={`detail-tab ${activeTab === 'deliveries' ? 'active' : ''}`} onClick={() => setActiveTab('deliveries')}>Entregas ({deliveries.length})</button>
        <button className={`detail-tab ${activeTab === 'sales' ? 'active' : ''}`} onClick={() => setActiveTab('sales')}>Ventas ({sales.length})</button>
        <button className={`detail-tab ${activeTab === 'settlements' ? 'active' : ''}`} onClick={() => setActiveTab('settlements')}>Liquidaciones ({settlements.length})</button>
      </div>

      {activeTab === 'overview' && stats && (
        <div>
          <div className="grid grid-4" style={{ marginBottom: '24px' }}>
            <div className="stat-card">
              <div className="card-label">Valor Inventario</div>
              <div className="stat-value" style={{ color: 'var(--gold-primary)' }}>{formatMoney(stats.inventoryValue)}</div>
            </div>
            <div className="stat-card">
              <div className="card-label">Ingresos por Ventas</div>
              <div className="stat-value" style={{ color: '#22c55e' }}>{formatMoney(stats.totalRevenue)}</div>
            </div>
            <div className="stat-card">
              <div className="card-label">Ganancia Neta</div>
              <div className="stat-value" style={{ color: stats.profit >= 0 ? 'var(--gold-primary)' : '#f87171' }}>{formatMoney(stats.profit)}</div>
            </div>
            <div className="stat-card">
              <div className="card-label">Empleados</div>
              <div className="stat-value">{stats.employeeCount}</div>
            </div>
          </div>

          <div className="grid grid-4" style={{ marginBottom: '32px' }}>
            <div className="stat-card">
              <div className="card-label">Productos</div>
              <div className="stat-value">{stats.totalProducts}</div>
            </div>
            <div className="stat-card">
              <div className="card-label">Stock Total</div>
              <div className="stat-value">{stats.totalStock}</div>
            </div>
            <div className="stat-card">
              <div className="card-label">Unidades Vendidas</div>
              <div className="stat-value" style={{ color: '#22c55e' }}>{stats.totalSoldQty}</div>
            </div>
            <div className="stat-card">
              <div className="card-label">Unidades Devueltas</div>
              <div className="stat-value" style={{ color: '#60a5fa' }}>{stats.totalReturnedQty}</div>
            </div>
          </div>

          <div className="detail-section-header">
            <h3 className="detail-section-title">Desglose</h3>
          </div>
          <div className="table-container" style={{ marginBottom: '32px' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Concepto</th>
                  <th style={{ textAlign: 'right' }}>Monto</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ fontWeight: 600 }}>Valor en Inventario</td>
                  <td style={{ textAlign: 'right', color: '#a78bfa' }}>{formatMoney(stats.inventoryValue)}</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>Total Entregado (costo)</td>
                  <td style={{ textAlign: 'right', color: '#f59e0b' }}>{formatMoney(stats.totalDeliveredValue)}</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>Ingresos por Ventas</td>
                  <td style={{ textAlign: 'right', color: '#22c55e' }}>{formatMoney(stats.totalRevenue)}</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>Valor Devuelto</td>
                  <td style={{ textAlign: 'right', color: '#60a5fa' }}>{formatMoney(stats.totalReturnedValue)}</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 700, color: 'var(--gold-primary)' }}>Ganancia Neta</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: stats.profit >= 0 ? 'var(--gold-primary)' : '#f87171' }}>{formatMoney(stats.profit)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {deliveries.length > 0 && (
            <div>
              <h3 className="detail-section-title" style={{ marginBottom: '16px' }}>Entregas Recientes</h3>
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Empleado</th>
                      <th>Producto</th>
                      <th style={{ textAlign: 'center' }}>Entregado</th>
                      <th style={{ textAlign: 'center' }}>Vendido</th>
                      <th style={{ textAlign: 'center' }}>Restante</th>
                      <th style={{ textAlign: 'center' }}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliveries.slice(0, 5).map(d => (
                      <tr key={d.id}>
                        <td style={{ fontWeight: 600 }}>{d.member_name}</td>
                        <td>{d.product_name}</td>
                        <td style={{ textAlign: 'center' }}>{d.quantity}</td>
                        <td style={{ textAlign: 'center', color: '#22c55e' }}>{d.total_sold || 0}</td>
                        <td style={{ textAlign: 'center', color: d.remaining > 0 ? '#f59e0b' : '#22c55e', fontWeight: 600 }}>{d.remaining || 0}</td>
                        <td style={{ textAlign: 'center' }}>
                          <span className={`badge badge-${d.status === 'settled' ? 'active' : ''}`} style={d.status === 'pending' ? { color: '#f59e0b', borderColor: '#f59e0b40', background: '#f59e0b15' } : {}}>
                            {d.status === 'pending' ? 'Pendiente' : 'Cerrada'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'inventory' && (
        <div>
          <div className="detail-section-header">
            <h3 className="detail-section-title">Productos</h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-outline" onClick={() => { setShowEntradaModal(true); setEntradaForm({ product_id: inventory[0]?.id || '', quantity: '', price: '', description: '' }); }}>+ Entrada</button>
              <button className="btn btn-gold" onClick={() => { setShowProductModal(true); setEditingProduct(null); setProductForm({ name: '', cost_price: '', selling_price: '' }); }}>+ Producto</button>
            </div>
          </div>
          {inventory.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">Sin productos</div>
              <div className="empty-state-text">Crea tu primer producto para comenzar</div>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th style={{ textAlign: 'center' }}>Stock</th>
                    <th style={{ textAlign: 'center' }}>Costo/u</th>
                    <th style={{ textAlign: 'center' }}>Precio Venta</th>
                    <th style={{ textAlign: 'center' }}>Valor Total</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {inventory.map(p => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600 }}>{p.name}</td>
                      <td style={{ textAlign: 'center', color: '#60a5fa', fontWeight: 600 }}>{p.quantity || 0}</td>
                      <td style={{ textAlign: 'center' }}>{formatMoney(p.cost_price)}</td>
                      <td style={{ textAlign: 'center', color: '#22c55e' }}>{formatMoney(p.selling_price)}</td>
                      <td style={{ textAlign: 'center', fontWeight: 600 }}>{formatMoney((p.quantity || 0) * (p.cost_price || 0))}</td>
                      <td>
                        <span style={{ display: 'flex', gap: '4px' }}>
                          <button className="btn btn-outline" style={{ padding: '2px 8px', fontSize: '11px' }} onClick={() => startEditProduct(p)}>Editar</button>
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

      {activeTab === 'employees' && (
        <div>
          <div className="detail-section-header">
            <h3 className="detail-section-title">Empleados</h3>
            <button className="btn btn-gold" onClick={() => { setShowAddEmployee(true); setAddEmployeeId(''); }}>+ Agregar Empleado</button>
          </div>
          {employees.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">◇</div>
              <div className="empty-state-title">Sin empleados</div>
              <div className="empty-state-text">Agrega miembros como empleados para asignarles productos</div>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Roles</th>
                    <th style={{ textAlign: 'center' }}>Entregas</th>
                    <th style={{ textAlign: 'center' }}>Pendientes</th>
                    <th style={{ textAlign: 'center' }}>Total Entregado</th>
                    <th style={{ textAlign: 'center' }}>Total Vendido</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map(emp => (
                    <tr key={emp.id}>
                      <td>
                        <Link to={`/members/${memberSlug(emp.name)}`} className="partner-cell" style={{ textDecoration: 'none', color: 'var(--text-primary)' }}>
                          <div className="partner-avatar">{emp.name.charAt(0)}</div>
                          {emp.name}
                        </Link>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {emp.roles.map(r => (
                            <span key={r.role} className="member-role-badge" style={{ color: r.color, borderColor: r.color + '40', background: r.color + '15', fontSize: '12px', padding: '2px 8px' }}>
                              {r.name}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>{emp.deliveries_count}</td>
                      <td style={{ textAlign: 'center', color: emp.pending_deliveries > 0 ? '#f59e0b' : 'var(--text-muted)' }}>{emp.pending_deliveries}</td>
                      <td style={{ textAlign: 'center', color: '#60a5fa' }}>{formatMoney(emp.total_delivered)}</td>
                      <td style={{ textAlign: 'center', color: '#22c55e' }}>{formatMoney(emp.total_revenue)}</td>
                      <td>
                        <button className="project-delete-btn" onClick={() => removeEmployee(emp.id)}>×</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'deliveries' && (
        <div>
          <div className="detail-section-header">
            <h3 className="detail-section-title">Entregas a Empleados</h3>
            <button className="btn btn-gold" onClick={() => { setShowDeliveryModal(true); setDeliveryForm({ member_id: employees[0]?.id || '', product_id: inventory[0]?.id || '', quantity: '', assigned_price: '', description: '' }); }}>+ Nueva Entrega</button>
          </div>
          {deliveries.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">Sin entregas</div>
              <div className="empty-state-text">Registra entregas de productos a empleados</div>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Empleado</th>
                    <th>Producto</th>
                    <th style={{ textAlign: 'center' }}>Entregado</th>
                    <th style={{ textAlign: 'center' }}>Vendido</th>
                    <th style={{ textAlign: 'center' }}>Devoluciones</th>
                    <th style={{ textAlign: 'center' }}>Restante</th>
                    <th style={{ textAlign: 'center' }}>Ingresos</th>
                    <th style={{ textAlign: 'center' }}>Precio/u</th>
                    <th style={{ textAlign: 'center' }}>Estado</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {deliveries.map(d => (
                    <tr key={d.id}>
                      <td style={{ fontWeight: 600 }}>{d.member_name}</td>
                      <td>{d.product_name}</td>
                      <td style={{ textAlign: 'center' }}>{d.quantity}</td>
                      <td style={{ textAlign: 'center', color: '#22c55e' }}>{d.total_sold || 0}</td>
                      <td style={{ textAlign: 'center', color: d.total_returned > 0 ? '#60a5fa' : 'var(--text-muted)' }}>{d.total_returned || 0}</td>
                      <td style={{ textAlign: 'center', fontWeight: 600, color: d.remaining > 0 ? '#f59e0b' : '#22c55e' }}>{d.remaining || 0}</td>
                      <td style={{ textAlign: 'center', color: '#22c55e', fontWeight: 600 }}>{formatMoney(d.total_revenue)}</td>
                      <td style={{ textAlign: 'center' }}>{formatMoney(d.assigned_price)}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`badge badge-${d.status === 'settled' ? 'active' : ''}`} style={d.status === 'pending' ? { color: '#f59e0b', borderColor: '#f59e0b40', background: '#f59e0b15' } : {}}>
                          {d.status === 'pending' ? 'Pendiente' : 'Cerrada'}
                        </span>
                      </td>
                      <td>
                        <span style={{ display: 'flex', gap: '4px' }}>
                          {d.status === 'pending' && d.remaining > 0 && (
                            <>
                              <button className="btn btn-outline" style={{ padding: '2px 8px', fontSize: '11px' }} onClick={() => {
                                setSaleForm({ delivery_id: d.id, quantity_sold: d.remaining, description: '' });
                                setShowSaleModal(true);
                              }}>Vender</button>
                              <button className="btn btn-outline" style={{ padding: '2px 8px', fontSize: '11px', borderColor: '#60a5fa40', color: '#60a5fa' }} onClick={() => {
                                setSettlementForm({ delivery_id: d.id, quantity_returned: d.remaining, description: '' });
                                setShowSettlementModal(true);
                              }}>Devolver</button>
                            </>
                          )}
                          <button className="project-delete-btn" onClick={() => deleteDelivery(d.id)}>×</button>
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

      {activeTab === 'sales' && (
        <div>
          <div className="detail-section-header">
            <h3 className="detail-section-title">Registro de Ventas</h3>
            <button className="btn btn-gold" onClick={() => { setShowSaleModal(true); setSaleForm({ delivery_id: pendingDeliveries[0]?.id || '', quantity_sold: '', description: '' }); }}>+ Registrar Venta</button>
          </div>
          {sales.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">Sin ventas registradas</div>
              <div className="empty-state-text">Registra ventas individuales por entrega</div>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Empleado</th>
                    <th>Producto</th>
                    <th style={{ textAlign: 'center' }}>Cantidad</th>
                    <th style={{ textAlign: 'center' }}>Precio/u</th>
                    <th style={{ textAlign: 'center' }}>Ingresos</th>
                    <th>Descripcion</th>
                    <th>Fecha</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map(s => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 600 }}>{s.member_name}</td>
                      <td>{s.product_name}</td>
                      <td style={{ textAlign: 'center', color: '#22c55e' }}>{s.quantity_sold}</td>
                      <td style={{ textAlign: 'center' }}>{formatMoney(s.revenue / s.quantity_sold)}</td>
                      <td style={{ textAlign: 'center', color: '#22c55e', fontWeight: 600 }}>{formatMoney(s.revenue)}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{s.description || '—'}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{new Date(s.date).toLocaleDateString('es-VE')}</td>
                      <td>
                        <button className="project-delete-btn" onClick={() => deleteSale(s.id)}>×</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'settlements' && (
        <div>
          <div className="detail-section-header">
            <h3 className="detail-section-title">Liquidaciones (Devoluciones)</h3>
          </div>
          {settlements.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">Sin liquidaciones</div>
              <div className="empty-state-text">Las devoluciones de productos apareceran aqui</div>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Empleado</th>
                    <th>Producto</th>
                    <th style={{ textAlign: 'center' }}>Devuelto</th>
                    <th>Descripcion</th>
                    <th>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {settlements.map(s => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 600 }}>{s.member_name}</td>
                      <td>{s.product_name}</td>
                      <td style={{ textAlign: 'center', color: '#60a5fa', fontWeight: 600 }}>{s.quantity_returned}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{s.description || '—'}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{new Date(s.date).toLocaleDateString('es-VE')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showProductModal && (
        <div className="modal-overlay" onClick={() => { setShowProductModal(false); setEditingProduct(null); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editingProduct ? 'Editar Producto' : 'Nuevo Producto'}</h2>
              <button className="modal-close" onClick={() => { setShowProductModal(false); setEditingProduct(null); }}>×</button>
            </div>
            <form onSubmit={createProduct}>
              <div className="form-group">
                <label className="form-label">Nombre *</label>
                <input className="form-input" placeholder="Ej: Bistec de res" value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} autoFocus />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Costo Unitario ($)</label>
                  <input type="number" className="form-input" placeholder="0.00" min="0" step="0.01" value={productForm.cost_price} onChange={(e) => setProductForm({ ...productForm, cost_price: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Precio de Venta ($)</label>
                  <input type="number" className="form-input" placeholder="0.00" min="0" step="0.01" value={productForm.selling_price} onChange={(e) => setProductForm({ ...productForm, selling_price: e.target.value })} />
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => { setShowProductModal(false); setEditingProduct(null); }}>Cancelar</button>
                <button type="submit" className="btn btn-gold">{editingProduct ? 'Guardar' : 'Crear'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEntradaModal && (
        <div className="modal-overlay" onClick={() => setShowEntradaModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Nueva Entrada de Inventario</h2>
              <button className="modal-close" onClick={() => setShowEntradaModal(false)}>×</button>
            </div>
            <form onSubmit={addEntrada}>
              <div className="form-group">
                <label className="form-label">Producto *</label>
                <select className="form-input" value={entradaForm.product_id} onChange={(e) => {
                  const prod = inventory.find(p => p.id === parseInt(e.target.value));
                  setEntradaForm({ ...entradaForm, product_id: e.target.value, price: prod ? prod.cost_price : '' });
                }}>
                  <option value="">Seleccionar producto...</option>
                  {inventory.map(p => (
                    <option key={p.id} value={p.id}>{p.name} (Stock: {p.quantity || 0})</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Cantidad *</label>
                  <input type="number" className="form-input" placeholder="0" min="0" value={entradaForm.quantity} onChange={(e) => setEntradaForm({ ...entradaForm, quantity: e.target.value })} autoFocus />
                </div>
                <div className="form-group">
                  <label className="form-label">Precio/u ($)</label>
                  <input type="number" className="form-input" placeholder="0.00" min="0" step="0.01" value={entradaForm.price} onChange={(e) => setEntradaForm({ ...entradaForm, price: e.target.value })} />
                </div>
              </div>
              {entradaForm.quantity > 0 && entradaForm.price > 0 && (
                <div style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Monto total:</span>
                  <span style={{ color: 'var(--gold-primary)', fontWeight: 700, fontSize: '18px' }}>{formatMoney(entradaForm.quantity * entradaForm.price)}</span>
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Descripcion</label>
                <input className="form-input" placeholder="Descripcion opcional..." value={entradaForm.description} onChange={(e) => setEntradaForm({ ...entradaForm, description: e.target.value })} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowEntradaModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-gold" disabled={!entradaForm.product_id || !entradaForm.quantity}>Registrar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeliveryModal && (
        <div className="modal-overlay" onClick={() => setShowDeliveryModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Nueva Entrega a Empleado</h2>
              <button className="modal-close" onClick={() => setShowDeliveryModal(false)}>×</button>
            </div>
            <form onSubmit={addDelivery}>
              <div className="form-group">
                <label className="form-label">Empleado *</label>
                <select className="form-input" value={deliveryForm.member_id} onChange={(e) => setDeliveryForm({ ...deliveryForm, member_id: e.target.value })}>
                  <option value="">Seleccionar empleado...</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Producto *</label>
                <select className="form-input" value={deliveryForm.product_id} onChange={(e) => {
                  const prod = inventory.find(p => p.id === parseInt(e.target.value));
                  setDeliveryForm({ ...deliveryForm, product_id: e.target.value, assigned_price: prod ? prod.selling_price : '' });
                }}>
                  <option value="">Seleccionar producto...</option>
                  {inventory.filter(p => p.quantity > 0).map(p => (
                    <option key={p.id} value={p.id}>{p.name} (Stock: {p.quantity})</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Cantidad *</label>
                  <input type="number" className="form-input" placeholder="0" min="0" value={deliveryForm.quantity} onChange={(e) => setDeliveryForm({ ...deliveryForm, quantity: e.target.value })} autoFocus />
                </div>
                <div className="form-group">
                  <label className="form-label">Precio de Venta/u ($)</label>
                  <input type="number" className="form-input" placeholder="0.00" min="0" step="0.01" value={deliveryForm.assigned_price} onChange={(e) => setDeliveryForm({ ...deliveryForm, assigned_price: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Descripcion</label>
                <input className="form-input" placeholder="Descripcion opcional..." value={deliveryForm.description} onChange={(e) => setDeliveryForm({ ...deliveryForm, description: e.target.value })} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowDeliveryModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-gold" disabled={!deliveryForm.member_id || !deliveryForm.product_id || !deliveryForm.quantity}>Entregar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showSaleModal && (
        <div className="modal-overlay" onClick={() => setShowSaleModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Registrar Venta</h2>
              <button className="modal-close" onClick={() => setShowSaleModal(false)}>×</button>
            </div>
            <form onSubmit={addSale}>
              {saleForm.delivery_id && (() => {
                const del = deliveries.find(d => d.id === parseInt(saleForm.delivery_id));
                if (!del) return null;
                return (
                  <div style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.2)', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px' }}>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      <strong style={{ color: 'var(--text-primary)' }}>{del.member_name}</strong> — {del.product_name}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      Disponible: <strong style={{ color: '#f59e0b' }}>{del.remaining}</strong> u. a {formatMoney(del.assigned_price)}/u
                    </div>
                  </div>
                );
              })()}
              <div className="form-group">
                <label className="form-label">Entrega *</label>
                <select className="form-input" value={saleForm.delivery_id} onChange={(e) => {
                  const del = deliveries.find(d => d.id === parseInt(e.target.value));
                  setSaleForm({ ...saleForm, delivery_id: e.target.value, quantity_sold: del ? del.remaining : '' });
                }}>
                  <option value="">Seleccionar entrega pendiente...</option>
                  {pendingDeliveries.filter(d => d.remaining > 0).map(d => (
                    <option key={d.id} value={d.id}>{d.member_name} — {d.product_name} ({d.remaining} u. restantes)</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Cantidad Vendida *</label>
                <input type="number" className="form-input" placeholder="0" min="0" value={saleForm.quantity_sold} onChange={(e) => setSaleForm({ ...saleForm, quantity_sold: e.target.value })} autoFocus />
              </div>
              {saleForm.delivery_id && saleForm.quantity_sold > 0 && (() => {
                const del = deliveries.find(d => d.id === parseInt(saleForm.delivery_id));
                if (!del) return null;
                const revenue = parseFloat(saleForm.quantity_sold) * del.assigned_price;
                return (
                  <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Ingreso generado:</span>
                    <span style={{ color: '#22c55e', fontWeight: 700, fontSize: '18px' }}>{formatMoney(revenue)}</span>
                  </div>
                );
              })()}
              <div className="form-group">
                <label className="form-label">Descripcion</label>
                <input className="form-input" placeholder="Descripcion opcional..." value={saleForm.description} onChange={(e) => setSaleForm({ ...saleForm, description: e.target.value })} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowSaleModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-gold" disabled={!saleForm.delivery_id || !saleForm.quantity_sold}>Registrar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showSettlementModal && (
        <div className="modal-overlay" onClick={() => setShowSettlementModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Devolver Productos</h2>
              <button className="modal-close" onClick={() => setShowSettlementModal(false)}>×</button>
            </div>
            <form onSubmit={addSettlement}>
              {settlementForm.delivery_id && (() => {
                const del = deliveries.find(d => d.id === parseInt(settlementForm.delivery_id));
                if (!del) return null;
                return (
                  <div style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px' }}>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      <strong style={{ color: 'var(--text-primary)' }}>{del.member_name}</strong> — {del.product_name}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      Disponible para devolver: <strong style={{ color: '#60a5fa' }}>{del.remaining}</strong> u.
                    </div>
                  </div>
                );
              })()}
              <div className="form-group">
                <label className="form-label">Entrega *</label>
                <select className="form-input" value={settlementForm.delivery_id} onChange={(e) => {
                  const del = deliveries.find(d => d.id === parseInt(e.target.value));
                  setSettlementForm({ ...settlementForm, delivery_id: e.target.value, quantity_returned: del ? del.remaining : '' });
                }}>
                  <option value="">Seleccionar entrega pendiente...</option>
                  {pendingDeliveries.filter(d => d.remaining > 0).map(d => (
                    <option key={d.id} value={d.id}>{d.member_name} — {d.product_name} ({d.remaining} u. restantes)</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Cantidad a Devolver *</label>
                <input type="number" className="form-input" placeholder="0" min="0" value={settlementForm.quantity_returned} onChange={(e) => setSettlementForm({ ...settlementForm, quantity_returned: e.target.value })} autoFocus />
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '16px' }}>
                Los productos devueltos seran agregados al inventario.
              </p>
              <div className="form-group">
                <label className="form-label">Descripcion</label>
                <input className="form-input" placeholder="Descripcion opcional..." value={settlementForm.description} onChange={(e) => setSettlementForm({ ...settlementForm, description: e.target.value })} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowSettlementModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-gold" disabled={!settlementForm.delivery_id}>Devolver</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAddEmployee && (
        <div className="modal-overlay" onClick={() => setShowAddEmployee(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Agregar Empleado</h2>
              <button className="modal-close" onClick={() => setShowAddEmployee(false)}>×</button>
            </div>
            <div className="form-group">
              <label className="form-label">Seleccionar Miembro</label>
              <select className="form-input" value={addEmployeeId} onChange={(e) => setAddEmployeeId(e.target.value)}>
                <option value="">Seleccionar...</option>
                {availableMembers.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '16px' }}>
              Se asignara el rol de <strong style={{ color: '#f59e0b' }}>Empleado</strong> y <strong style={{ color: '#60a5fa' }}>Socio</strong> automaticamente.
            </p>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setShowAddEmployee(false)}>Cancelar</button>
              <button className="btn btn-gold" onClick={addEmployee} disabled={!addEmployeeId}>Agregar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
