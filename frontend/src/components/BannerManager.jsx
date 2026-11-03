import { useState, useEffect } from 'react';
import { ChevronUp, ChevronDown, Plus, Edit2, Trash2, X } from 'lucide-react';
import styles from '../styles/BannerManager.module.css';

const AVAILABLE_PAGES = [
  'home',
  'login',
  'register',
  'dashboard',
  'plans',
  'booking',
  'profile',
  'checkout'
];

export default function BannerManager() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    backgroundColor: '#3B82F6',
    textColor: '#FFFFFF',
    startDate: '',
    startTime: '00:00',
    endDate: '',
    endTime: '23:59',
    pages: []
  });

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api';

  useEffect(() => {
    if (isExpanded) {
      fetchBanners();
    }
  }, [isExpanded]);

  const fetchBanners = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('cas_jwt');
      const response = await fetch(`${apiBaseUrl}/admin/banners`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch banners');
      const data = await response.json();
      setBanners(data.banners || []);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (type === 'checkbox') {
      const pageValue = value;
      setFormData(prev => ({
        ...prev,
        pages: checked
          ? [...prev.pages, pageValue]
          : prev.pages.filter(p => p !== pageValue)
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.title.trim() || !formData.content.trim()) {
      setError('Title and content are required');
      return;
    }

    if (formData.pages.length === 0) {
      setError('Select at least one page');
      return;
    }

    try {
      const token = localStorage.getItem('cas_jwt');
      const url = editingId
        ? `${apiBaseUrl}/admin/banners/${editingId}`
        : `${apiBaseUrl}/admin/banners`;
      
      const method = editingId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to save banner');
      }

      await fetchBanners();
      resetForm();
      setError('');
    } catch (err) {
      setError(err.message);
    }
  };

  const formatDateForInput = (dateString) => {
    if (!dateString) return '';
    // If it's ISO format (2026-11-02T05:00:00.000Z), extract just the date part
    if (dateString.includes('T')) {
      return dateString.split('T')[0];
    }
    // Otherwise assume it's already in yyyy-MM-dd format
    return dateString;
  };

  const handleEdit = (banner) => {
    setEditingId(banner.id);
    setFormData({
      title: banner.title,
      content: banner.content,
      backgroundColor: banner.background_color,
      textColor: banner.text_color,
      startDate: formatDateForInput(banner.start_date),
      startTime: banner.start_time,
      endDate: formatDateForInput(banner.end_date),
      endTime: banner.end_time,
      pages: banner.pages
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this banner?')) return;

    try {
      const token = localStorage.getItem('cas_jwt');
      const response = await fetch(`${apiBaseUrl}/admin/banners/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to delete banner');
      await fetchBanners();
      setError('');
    } catch (err) {
      setError(err.message);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      content: '',
      backgroundColor: '#3B82F6',
      textColor: '#FFFFFF',
      startDate: '',
      startTime: '00:00',
      endDate: '',
      endTime: '23:59',
      pages: []
    });
    setEditingId(null);
    setShowForm(false);
  };

  return (
    <div className={styles.card}>
      <button
        type="button"
        className={styles.headerButton}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h2 className={styles.title}>Banners Management</h2>
        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </button>

      {isExpanded && (
        <div className={styles.collapsibleContent}>
          {error && <div className={styles.error}>{error}</div>}

          {!showForm && (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className={styles.addButton}
            >
              <Plus size={18} />
              Add Banner ({banners.length}/3)
            </button>
          )}

          {showForm && (
            <form onSubmit={handleSubmit} className={styles.form}>
              <h3>{editingId ? 'Edit Banner' : 'Create Banner'}</h3>

              <div className={styles.formGroup}>
                <label>Title *</label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  placeholder="e.g., System Maintenance"
                  maxLength={255}
                />
              </div>

              <div className={styles.formGroup}>
                <label>Content *</label>
                <textarea
                  name="content"
                  value={formData.content}
                  onChange={handleInputChange}
                  placeholder="e.g., We will be down for maintenance..."
                  rows={3}
                />
              </div>

              <div className={styles.colorRow}>
                <div className={styles.formGroup}>
                  <label>Background Color</label>
                  <input
                    type="color"
                    name="backgroundColor"
                    value={formData.backgroundColor}
                    onChange={handleInputChange}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Text Color</label>
                  <input
                    type="color"
                    name="textColor"
                    value={formData.textColor}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div className={styles.dateTimeRow}>
                <div className={styles.formGroup}>
                  <label>Start Date *</label>
                  <input
                    type="date"
                    name="startDate"
                    value={formData.startDate}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Start Time</label>
                  <input
                    type="time"
                    name="startTime"
                    value={formData.startTime}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div className={styles.dateTimeRow}>
                <div className={styles.formGroup}>
                  <label>End Date *</label>
                  <input
                    type="date"
                    name="endDate"
                    value={formData.endDate}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>End Time</label>
                  <input
                    type="time"
                    name="endTime"
                    value={formData.endTime}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label>Display on Pages * (select at least one)</label>
                <div className={styles.pageCheckboxes}>
                  {AVAILABLE_PAGES.map(page => (
                    <label key={page} className={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        name={page}
                        value={page}
                        checked={formData.pages.includes(page)}
                        onChange={handleInputChange}
                      />
                      {page.charAt(0).toUpperCase() + page.slice(1)}
                    </label>
                  ))}
                </div>
              </div>

              <div className={styles.formActions}>
                <button type="button" onClick={resetForm} className={styles.cancelButton}>
                  Cancel
                </button>
                <button type="submit" className={styles.submitButton}>
                  {editingId ? 'Update Banner' : 'Create Banner'}
                </button>
              </div>
            </form>
          )}

          {loading ? (
            <div className={styles.loading}>Loading banners...</div>
          ) : banners.length > 0 ? (
            <div className={styles.bannersList}>
              {banners.map(banner => (
                <div
                  key={banner.id}
                  className={styles.bannerItem}
                  style={{ backgroundColor: banner.background_color }}
                >
                  <div className={styles.bannerContent}>
                    <h4 style={{ color: banner.text_color }}>{banner.title}</h4>
                    <p style={{ color: banner.text_color }}>{banner.content}</p>
                    <div className={styles.bannerMeta}>
                      <small style={{ color: banner.text_color }}>
                        {banner.start_date} {banner.start_time} → {banner.end_date} {banner.end_time}
                      </small>
                      <small style={{ color: banner.text_color }}>
                        Pages: {banner.pages.join(', ')}
                      </small>
                    </div>
                  </div>
                  <div className={styles.bannerActions}>
                    <button
                      onClick={() => handleEdit(banner)}
                      className={styles.editButton}
                      title="Edit"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(banner.id)}
                      className={styles.deleteButton}
                      title="Delete"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.empty}>No banners yet. Create one to get started!</div>
          )}
        </div>
      )}
    </div>
  );
}
