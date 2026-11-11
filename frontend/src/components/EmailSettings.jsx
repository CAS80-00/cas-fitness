import { useState, useEffect } from 'react';
import { Mail, Save, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import styles from '../styles/EmailSettings.module.css';

export default function EmailSettings({ currentUser }) {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api';
  const [isExpanded, setIsExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [formData, setFormData] = useState({
    gmailUser: '',
    gmailPassword: '',
    superuserEmail: '',
  });

  // Receipt template management
  const [showReceiptTemplateModal, setShowReceiptTemplateModal] = useState(false);
  const [receiptTemplateContent, setReceiptTemplateContent] = useState('');
  const [templateSaveMessage, setTemplateSaveMessage] = useState('');

  // Consultation scheduling template management
  const [showConsultationTemplateModal, setShowConsultationTemplateModal] = useState(false);
  const [consultationTemplateContent, setConsultationTemplateContent] = useState('');
  const [consultationSaveMessage, setConsultationSaveMessage] = useState('');

  // Plan purchase template management
  const [showPlanPurchaseTemplateModal, setShowPlanPurchaseTemplateModal] = useState(false);
  const [planPurchaseTemplateContent, setPlanPurchaseTemplateContent] = useState('');
  const [planPurchaseSaveMessage, setPlanPurchaseSaveMessage] = useState('');

  useEffect(() => {
    if (isExpanded) {
      fetchEmailConfig();
    }
  }, [isExpanded]);

  const fetchEmailConfig = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('cas_jwt');
      const res = await fetch(`${apiBaseUrl}/admin/email-config`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error('Failed to fetch email config');

      const data = await res.json();
      if (data.config) {
        setFormData({
          gmailUser: data.config.gmailUser || '',
          gmailPassword: '',
          superuserEmail: data.config.superuserEmail || '',
        });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.gmailUser || !formData.gmailPassword || !formData.superuserEmail) {
      setError('All fields are required');
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('cas_jwt');
      const res = await fetch(`${apiBaseUrl}/admin/email-config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save email configuration');
      }

      const data = await res.json();
      setSuccess('Email configuration saved successfully!');
      
      // Clear password field after saving
      setFormData(prev => ({ ...prev, gmailPassword: '' }));
      
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const openReceiptTemplateModal = () => {
    const savedTemplate = localStorage.getItem('cas_paymentReceiptTemplate');
    const defaultTemplate = `Subject: CAS Fitness - Payment Receipt #[TRANSACTION_ID]

Hello [STUDENT_NAME],

Your payment has been received and processed successfully.

Receipt Details:
────────────────────
Receipt Date: [RECEIPT_DATE]
Payment Type: [PAYMENT_TYPE]
Transaction ID: [TRANSACTION_ID]
────────────────────

Payment Summary:
────────────────────
Plan: [PLAN_TITLE]
Amount: $[AMOUNT]
────────────────────

TOTAL: $[AMOUNT]

This is an automated receipt for your payment. For any questions or disputes regarding this transaction, please contact our support team.

For support, contact: [SUPERUSER_EMAIL]

© 2026 CAS Fitness. All rights reserved.`;

    setReceiptTemplateContent(savedTemplate || defaultTemplate);
    setTemplateSaveMessage('');
    setShowReceiptTemplateModal(true);
  };

  const saveReceiptTemplate = () => {
    localStorage.setItem('cas_paymentReceiptTemplate', receiptTemplateContent);
    setTemplateSaveMessage('Receipt template saved successfully!');
    setTimeout(() => setTemplateSaveMessage(''), 2000);
  };

  const openConsultationTemplateModal = () => {
    const savedTemplate = localStorage.getItem('cas_consultationSchedulingTemplate');
    const defaultTemplate = `Subject: CAS Fitness - Consultation Scheduled on [CONSULTATION_DATE]

Dear [CLIENT_NAME],

Your consultation with [TRAINER_NAME] has been scheduled!

────────────────────────────────────────
CONSULTATION DETAILS
────────────────────────────────────────
Date: [CONSULTATION_DATE]
Time: [CONSULTATION_TIME]
Duration: [DURATION]
Location: [LOCATION]

Trainer: [TRAINER_NAME]
Contact: [CONTACT_EMAIL]

────────────────────────────────────────
WHAT TO BRING
────────────────────────────────────────
• Valid photo ID
• Comfortable workout clothes
• Water bottle
• Any medical documents if relevant

────────────────────────────────────────
INSTRUCTIONS & GUIDELINES
────────────────────────────────────────
[INSTRUCTIONS]

If you need to reschedule or cancel, please contact us at least 24 hours in advance at [CONTACT_EMAIL] or [SUPERUSER_EMAIL].

We look forward to working with you!

Best regards,
CAS Fitness Team
[SUPERUSER_EMAIL]

© 2026 CAS Fitness. All rights reserved.`;

    setConsultationTemplateContent(savedTemplate || defaultTemplate);
    setConsultationSaveMessage('');
    setShowConsultationTemplateModal(true);
  };

  const saveConsultationTemplate = () => {
    localStorage.setItem('cas_consultationSchedulingTemplate', consultationTemplateContent);
    setConsultationSaveMessage('Consultation template saved successfully!');
    setTimeout(() => setConsultationSaveMessage(''), 2000);
  };

  const openPlanPurchaseTemplateModal = () => {
    const savedTemplate = localStorage.getItem('cas_planPurchaseTemplate');
    const defaultTemplate = `Subject: CAS Fitness - Plan Purchase Confirmation #[PLAN_ID]

Dear [CUSTOMER_NAME],

Thank you for purchasing a plan with CAS Fitness! We're excited to have you join our community.

────────────────────────────────────────
PLAN DETAILS
────────────────────────────────────────
Plan Name: [PLAN_NAME]
Plan Duration: [PLAN_DURATION]
Price: $[PLAN_PRICE]
Purchase Date: [PURCHASE_DATE]
Transaction ID: [TRANSACTION_ID]

────────────────────────────────────────
WHAT'S INCLUDED
────────────────────────────────────────
[PLAN_DESCRIPTION]

────────────────────────────────────────
GETTING STARTED
────────────────────────────────────────
Your plan is now active! Here's what you need to do:

1. Log in to your CAS Fitness account with your credentials
2. Visit your profile to manage your subscription
3. Schedule your first consultation with one of our trainers
4. Explore our training programs and facilities

────────────────────────────────────────
NEXT STEPS
────────────────────────────────────────
[NEXT_STEPS]

────────────────────────────────────────
SUPPORT & QUESTIONS
────────────────────────────────────────
If you have any questions about your plan or need assistance, please don't hesitate to reach out:

Email: [SUPERUSER_EMAIL]
Phone: [CONTACT_PHONE]

We're here to help you achieve your fitness goals!

────────────────────────────────────────

Thank you for choosing CAS Fitness!

Best regards,
CAS Fitness Team
[SUPERUSER_EMAIL]

© 2026 CAS Fitness. All rights reserved.`;

    setPlanPurchaseTemplateContent(savedTemplate || defaultTemplate);
    setPlanPurchaseSaveMessage('');
    setShowPlanPurchaseTemplateModal(true);
  };

  const savePlanPurchaseTemplate = () => {
    localStorage.setItem('cas_planPurchaseTemplate', planPurchaseTemplateContent);
    setPlanPurchaseSaveMessage('Plan purchase template saved successfully!');
    setTimeout(() => setPlanPurchaseSaveMessage(''), 2000);
  };

  return (
    <div className={styles.container}>
      <button
        className={styles.headerButton}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className={styles.headerContent}>
          <Mail size={24} />
          <h2>Email Configuration</h2>
        </div>
        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </button>

      {isExpanded && (
        <div className={styles.collapsibleContent}>
          <p className={styles.description}>
            Configure Gmail credentials to enable automatic email notifications for purchase confirmations and customer alerts.
          </p>

          {error && (
            <div className={styles.alert} style={{ borderLeftColor: '#dc2626' }}>
              <AlertCircle size={18} style={{ color: '#dc2626' }} />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className={styles.alert} style={{ borderLeftColor: '#22c55e' }}>
              <span style={{ color: '#22c55e' }}>✓ {success}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.formGroup}>
              <label htmlFor="gmailUser">Gmail Address</label>
              <input
                id="gmailUser"
                type="email"
                name="gmailUser"
                value={formData.gmailUser}
                onChange={handleChange}
                placeholder="your-email@gmail.com"
                disabled={loading || saving}
                required
              />
              <p className={styles.hint}>The Gmail account that will send emails</p>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="gmailPassword">Gmail App Password</label>
              <input
                id="gmailPassword"
                type="password"
                name="gmailPassword"
                value={formData.gmailPassword}
                onChange={handleChange}
                placeholder="xxxx xxxx xxxx xxxx"
                disabled={loading || saving}
                required
              />
              <p className={styles.hint}>
                16-character app password (not your regular Gmail password).{' '}
                <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer">
                  Get App Password
                </a>
              </p>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="superuserEmail">Superuser Email</label>
              <input
                id="superuserEmail"
                type="email"
                name="superuserEmail"
                value={formData.superuserEmail}
                onChange={handleChange}
                placeholder="castech7777@gmail.com"
                disabled={loading || saving}
                required
              />
              <p className={styles.hint}>Email address that receives purchase notifications</p>
            </div>

            <div className={styles.infoBox}>
              <h4>How to Get Gmail App Password:</h4>
              <ol>
                <li>Go to <a href="https://myaccount.google.com" target="_blank" rel="noopener noreferrer">myaccount.google.com</a></li>
                <li>Click <strong>Security</strong> (left sidebar)</li>
                <li>Enable <strong>2-Step Verification</strong> if not already enabled</li>
                <li>Search for <strong>App passwords</strong></li>
                <li>Select <strong>Mail</strong> and <strong>Windows Computer</strong></li>
                <li>Copy the 16-character password generated</li>
              </ol>
            </div>

            <button 
              type="submit" 
              className={styles.submitButton}
              disabled={loading || saving}
            >
              <Save size={18} />
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
          </form>

          <div className={styles.templateManagementSection}>
            <h3>Email Templates</h3>
            <p className={styles.description}>
              Customize email templates sent to customers
            </p>
            <div className={styles.templateButtonGroup}>
              <button
                type="button"
                onClick={openReceiptTemplateModal}
                className={styles.manageTemplateButton}
              >
                Manage Receipt Template
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    const response = await fetch(`${apiBaseUrl}/stripe/test-receipt`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        email: formData.superuserEmail || 'test@example.com',
                        studentName: 'Test Student',
                        planTitle: 'Premium Plan',
                        amount: '99.99',
                        paymentType: 'purchase'
                      }),
                    });
                    
                    const data = await response.json();
                    
                    if (response.ok && data.success) {
                      setSuccess('Test receipt email sent! Check your email.');
                      setTimeout(() => setSuccess(''), 3000);
                    } else {
                      setError(data.error || 'Failed to send test receipt email');
                    }
                  } catch (err) {
                    setError('Error sending test email: ' + err.message);
                  }
                }}
                className={styles.testButton}
              >
                Send Test Receipt
              </button>
            </div>

            <div className={styles.templateDivider}></div>

            <div className={styles.templateSubsection}>
              <h4>Consultation Scheduling Template</h4>
              <div className={styles.templateButtonGroup}>
                <button
                  type="button"
                  onClick={openConsultationTemplateModal}
                  className={styles.manageTemplateButton}
                >
                  Manage Consultation Template
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const response = await fetch(`${apiBaseUrl}/stripe/test-consultation`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          email: formData.superuserEmail || 'test@example.com',
                          clientName: 'Test Client',
                          trainerName: 'Test Trainer',
                          consultationDate: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
                          consultationTime: '2:00 PM',
                          duration: '60 minutes',
                          location: 'CAS Fitness Studio',
                          contactEmail: formData.superuserEmail || 'test@example.com',
                          instructions: 'Please arrive 10 minutes early. Bring your ID and wear comfortable workout attire.'
                        }),
                      });
                      
                      const data = await response.json();
                      
                      if (response.ok && data.success) {
                        setSuccess('Test consultation email sent! Check your email.');
                        setTimeout(() => setSuccess(''), 3000);
                      } else {
                        setError(data.error || 'Failed to send test consultation email');
                      }
                    } catch (err) {
                      setError('Error sending test email: ' + err.message);
                    }
                  }}
                  className={styles.testButton}
                >
                  Send Test Consultation Email
                </button>
              </div>
            </div>

            <div className={styles.templateDivider}></div>

            <div className={styles.templateSubsection}>
              <h4>Plan Purchase Template</h4>
              <div className={styles.templateButtonGroup}>
                <button
                  type="button"
                  onClick={openPlanPurchaseTemplateModal}
                  className={styles.manageTemplateButton}
                >
                  Manage Plan Purchase Template
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const response = await fetch(`${apiBaseUrl}/stripe/test-plan-purchase`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          email: formData.superuserEmail || 'test@example.com',
                          customerName: 'Test Customer',
                          planName: 'Premium Membership',
                          planDuration: '12 Months',
                          planPrice: '199.99',
                          purchaseDate: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
                          planId: 'TEST_PLAN_001',
                          transactionId: `TEST_${Date.now()}`,
                          planDescription: 'Unlimited gym access, group fitness classes, and personal training sessions.',
                          nextSteps: 'Your account is active immediately. Visit your profile to schedule your first consultation.'
                        }),
                      });
                      
                      const data = await response.json();
                      
                      if (response.ok && data.success) {
                        setSuccess('Test plan purchase email sent! Check your email.');
                        setTimeout(() => setSuccess(''), 3000);
                      } else {
                        setError(data.error || 'Failed to send test plan purchase email');
                      }
                    } catch (err) {
                      setError('Error sending test email: ' + err.message);
                    }
                  }}
                  className={styles.testButton}
                >
                  Send Test Plan Purchase Email
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showReceiptTemplateModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2>Edit Payment Receipt Template</h2>
              <button
                type="button"
                onClick={() => setShowReceiptTemplateModal(false)}
                className={styles.closeButton}
              >
                ✕
              </button>
            </div>

            <div className={styles.modalContent}>
              <p className={styles.templateHint}>
                Available placeholders: [STUDENT_NAME], [RECEIPT_DATE], [PAYMENT_TYPE], [TRANSACTION_ID], [PLAN_TITLE], [AMOUNT], [SUPERUSER_EMAIL]
              </p>
              <textarea
                value={receiptTemplateContent}
                onChange={(e) => setReceiptTemplateContent(e.target.value)}
                className={styles.templateTextarea}
                rows={15}
              />

              {templateSaveMessage && (
                <div className={styles.successMessage}>
                  ✓ {templateSaveMessage}
                </div>
              )}
            </div>

            <div className={styles.modalFooter}>
              <button
                type="button"
                onClick={() => setShowReceiptTemplateModal(false)}
                className={styles.cancelButton}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveReceiptTemplate}
                className={styles.saveButton}
              >
                <Save size={16} />
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {showConsultationTemplateModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2>Edit Consultation Scheduling Template</h2>
              <button
                type="button"
                onClick={() => setShowConsultationTemplateModal(false)}
                className={styles.closeButton}
              >
                ✕
              </button>
            </div>

            <div className={styles.modalContent}>
              <p className={styles.templateHint}>
                Available placeholders: [CLIENT_NAME], [TRAINER_NAME], [CONSULTATION_DATE], [CONSULTATION_TIME], [DURATION], [LOCATION], [CONTACT_EMAIL], [INSTRUCTIONS], [SUPERUSER_EMAIL]
              </p>
              <textarea
                value={consultationTemplateContent}
                onChange={(e) => setConsultationTemplateContent(e.target.value)}
                className={styles.templateTextarea}
                rows={15}
              />

              {consultationSaveMessage && (
                <div className={styles.successMessage}>
                  ✓ {consultationSaveMessage}
                </div>
              )}
            </div>

            <div className={styles.modalFooter}>
              <button
                type="button"
                onClick={() => setShowConsultationTemplateModal(false)}
                className={styles.cancelButton}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveConsultationTemplate}
                className={styles.saveButton}
              >
                <Save size={16} />
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {showPlanPurchaseTemplateModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2>Edit Plan Purchase Template</h2>
              <button
                type="button"
                onClick={() => setShowPlanPurchaseTemplateModal(false)}
                className={styles.closeButton}
              >
                ✕
              </button>
            </div>

            <div className={styles.modalContent}>
              <p className={styles.templateHint}>
                Available placeholders: [CUSTOMER_NAME], [PLAN_NAME], [PLAN_DURATION], [PLAN_PRICE], [PURCHASE_DATE], [PLAN_ID], [TRANSACTION_ID], [PLAN_DESCRIPTION], [NEXT_STEPS], [SUPERUSER_EMAIL], [CONTACT_PHONE]
              </p>
              <textarea
                value={planPurchaseTemplateContent}
                onChange={(e) => setPlanPurchaseTemplateContent(e.target.value)}
                className={styles.templateTextarea}
                rows={15}
              />

              {planPurchaseSaveMessage && (
                <div className={styles.successMessage}>
                  ✓ {planPurchaseSaveMessage}
                </div>
              )}
            </div>

            <div className={styles.modalFooter}>
              <button
                type="button"
                onClick={() => setShowPlanPurchaseTemplateModal(false)}
                className={styles.cancelButton}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={savePlanPurchaseTemplate}
                className={styles.saveButton}
              >
                <Save size={16} />
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
