import { useRef } from 'react';
import { toPng } from 'html-to-image';
import './BankReceipt.css';

const formatMoney = (amount) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol' }).format(amount || 0);
};

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('es-VE', { day: '2-digit', month: 'long', year: 'numeric' });
};

export default function BankReceipt({ type, data, onClose }) {
  const cardRef = useRef(null);

  const downloadImage = async () => {
    if (!cardRef.current) return;
    try {
      const dataUrl = await toPng(cardRef.current, {
        backgroundColor: '#0a0a0a',
        pixelRatio: 2,
        style: { transform: 'none' },
        filter: (node) => !node.classList?.contains('receipt-footer'),
      });
      const link = document.createElement('a');
      link.download = type === 'loan'
        ? `prestamo-${data.client_name?.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.png`
        : `pago-${data.client_name?.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Error al generar imagen:', err);
    }
  };

  const now = new Date().toLocaleDateString('es-VE', {
    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  return (
    <div className="receipt-overlay" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}>
        <div className="receipt-card" ref={cardRef}>
          <div className="receipt-header">
            <p className="receipt-bank-name">BANCO MAZE</p>
            <p className="receipt-type">{type === 'loan' ? 'Comprobante de Prestamo' : 'Comprobante de Pago'}</p>
          </div>

          <div className="receipt-body">
            {type === 'loan' ? (
              <>
                <ReceiptRow label="Cliente" value={data.client_name} />
                <ReceiptRow label="Monto prestado" value={formatMoney(data.amount)} />
                <ReceiptRow label="Tasa de interes" value={`${data.interest_pct}%`} />
                {data.description && <ReceiptRow label="Descripcion" value={data.description} />}
                <ReceiptRow label="Fecha de creacion" value={formatDate(data.created_at)} />
                <ReceiptRow label="Fecha limite" value={formatDate(data.deadline)} />
                <div className="receipt-divider" />
                <div className="receipt-row-total">
                  <span className="receipt-row-label">Total a cobrar</span>
                  <span className="receipt-row-value">{formatMoney(data.total_to_pay)}</span>
                </div>
              </>
            ) : (
              <>
                <ReceiptRow label="Cliente" value={data.client_name} />
                <ReceiptRow label="Prestamo #" value={`#${data.loan_id}`} />
                <ReceiptRow label="Monto pagado" value={formatMoney(data.payment_amount)} />
                <ReceiptRow label="Restante" value={formatMoney(data.remaining)} highlight={data.remaining > 0} />
                {data.description && <ReceiptRow label="Descripcion" value={data.description} />}
                <div className="receipt-divider" />
                <div className="receipt-row-total">
                  <span className="receipt-row-label">Estado</span>
                  <span className="receipt-row-value" style={{ fontSize: '16px', color: data.remaining <= 0 ? '#22c55e' : '#f59e0b' }}>
                    {data.remaining <= 0 ? 'PAGADO COMPLETO' : 'PAGO REGISTRADO'}
                  </span>
                </div>
              </>
            )}
          </div>

          <div className="receipt-stamp">
            <strong>LEGACY Caraballo Enterprises</strong> — {now}
          </div>

          <div className="receipt-footer">
            <button className="btn btn-gold" onClick={downloadImage}>
              <i className="fa-solid fa-download" style={{ marginRight: '6px' }} />
              Descargar imagen
            </button>
            <button className="btn btn-outline" onClick={onClose}>Cerrar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReceiptRow({ label, value, highlight }) {
  return (
    <div className="receipt-row">
      <span className="receipt-row-label">{label}</span>
      <span className="receipt-row-value" style={highlight ? { color: '#f59e0b' } : undefined}>{value}</span>
    </div>
  );
}
