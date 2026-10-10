/** Saved addresses: add, edit, delete, set default. All scoped to the user. */
import { useEffect, useState } from 'react';
import { Endpoints } from '../../api/client.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { EmptyState, Alert, BlockSkeleton, Modal } from '../../components/ui/index.jsx';

const EMPTY = { label: 'Home', fullName: '', phone: '', line1: '', line2: '', city: '', state: '', pincode: '', landmark: '' };

export default function Addresses() {
  const { user } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState(null);

  const load = () => {
    setLoading(true);
    setError(null);
    Endpoints.addresses()
      .then((r) => setItems(r.items))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const openNew = () => {
    setForm({ ...EMPTY, fullName: user.name, phone: user.mobile || '' });
    setEditing('new');
    setFormError(null);
  };

  const openEdit = (a) => {
    setForm({
      label: a.label, fullName: a.fullName, phone: a.phone, line1: a.line1, line2: a.line2 || '',
      city: a.city, state: a.state, pincode: a.pincode, landmark: a.landmark || '',
    });
    setEditing(a.id);
    setFormError(null);
  };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setFormError(null);
    try {
      if (editing === 'new') {
        const res = await Endpoints.addAddress(form);
        setItems((list) => [res.address, ...list]);
        toast.success('Address added');
      } else {
        const res = await Endpoints.updateAddress(editing, form);
        setItems((list) => list.map((a) => (a.id === res.address.id ? res.address : a)));
        toast.success('Address updated');
      }
      setEditing(null);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (a) => {
    try {
      await Endpoints.deleteAddress(a.id);
      setItems((list) => list.filter((x) => x.id !== a.id));
      toast.info('Address removed');
    } catch (err) { toast.error(err.message); }
  };

  const setDefault = async (a) => {
    try {
      await Endpoints.setDefaultAddress(a.id);
      setItems((list) => list.map((x) => ({ ...x, isDefault: x.id === a.id })));
      toast.success(`${a.label} set as default`);
    } catch (err) { toast.error(err.message); }
  };

  const field = (id, label, props = {}) => (
    <div className={`field ${props.wide ? '' : 'grow'}`}>
      <label className="field-label" htmlFor={id}>{label}</label>
      <input id={id} className="input" value={form[id] ?? ''} required={props.required !== false}
        onChange={(e) => setForm((f) => ({ ...f, [id]: e.target.value }))}
        {...(props.input || {})} />
    </div>
  );

  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="row-between">
        <h2>Saved addresses</h2>
        <button type="button" className="btn btn-sm" onClick={openNew}>+ Add address</button>
      </div>

      {error && <Alert tone="danger">{error}</Alert>}

      {loading ? (
        <BlockSkeleton height={100} count={2} />
      ) : items.length === 0 ? (
        <div className="card">
          <EmptyState icon="📍" title="No saved addresses"
            message="Add a delivery address so checkout is one tap away."
            action={<button type="button" className="btn" onClick={openNew}>Add your first address</button>} />
        </div>
      ) : (
        <div className="col" style={{ gap: 12 }}>
          {items.map((a) => (
            <div className="card card-pad" key={a.id}>
              <div className="row-between wrap">
                <div style={{ minWidth: 0 }}>
                  <div className="row" style={{ gap: 8 }}>
                    <b>{a.label}</b>
                    {a.isDefault && <span className="badge">Default</span>}
                  </div>
                  <p style={{ margin: '4px 0 0' }}>
                    <b>{a.fullName}</b> · {a.phone}<br />
                    {a.line1}{a.line2 ? `, ${a.line2}` : ''}, {a.city}, {a.state} {a.pincode}
                    {a.landmark ? ` · ${a.landmark}` : ''}
                  </p>
                </div>
                <div className="row wrap">
                  {!a.isDefault && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDefault(a)}>Set default</button>}
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => openEdit(a)}>Edit</button>
                  <button type="button" className="link-btn" onClick={() => remove(a)}>Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Add address' : 'Edit address'}
        footer={(
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
            <button type="submit" form="address-form" className="btn" disabled={busy}>
              {busy ? 'Saving…' : 'Save address'}
            </button>
          </>
        )}
      >
        <form id="address-form" onSubmit={save} className="col" style={{ gap: 12 }}>
          {formError && <Alert tone="danger">{formError}</Alert>}
          <div className="row wrap">
            <div className="field grow">
              <label className="field-label" htmlFor="a-label">Label</label>
              <select id="a-label" className="select" value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}>
                <option>Home</option><option>Work</option><option>Other</option>
              </select>
            </div>
            {field('fullName', 'Full name')}
            {field('phone', 'Mobile number', { input: { inputMode: 'numeric', maxLength: 10 } })}
          </div>
          {field('line1', 'Flat / house / street', { wide: true })}
          {field('line2', 'Area (optional)', { wide: true, required: false })}
          <div className="row wrap">
            {field('city', 'City')}
            {field('state', 'State')}
            {field('pincode', 'PIN code', { input: { inputMode: 'numeric', maxLength: 6 } })}
          </div>
          {field('landmark', 'Landmark (optional)', { wide: true, required: false })}
        </form>
      </Modal>
    </div>
  );
}
