export default function PrivacyPolicyPage() {
  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '48px 24px', fontFamily: 'DM Sans, sans-serif', color: '#1d1d1f', lineHeight: 1.7 }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: 8 }}>Privacy Policy</h1>
      <p style={{ color: '#6e6e73', marginBottom: 40 }}>Last updated: March 2026</p>

      <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginTop: 32, marginBottom: 8 }}>1. Who We Are</h2>
      <p>SolarOps is an AI-powered operations platform for Australian solar businesses, developed by ONE AGENCY (ABN to be inserted). Our registered address is in Australia. Contact: hello@solarops.com.au</p>

      <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginTop: 32, marginBottom: 8 }}>2. What Data We Collect</h2>
      <p>We collect the following types of data:</p>
      <ul style={{ paddingLeft: 24 }}>
        <li><strong>Account data:</strong> Name, email address, and organisation name provided at sign-up.</li>
        <li><strong>Google account data:</strong> When you connect Gmail, we access your email address and inbox messages solely to provide the Inbox Assistant feature.</li>
        <li><strong>Uploaded documents:</strong> Electricity bills or images you upload for the Bill &amp; NMI Reader.</li>
        <li><strong>Usage data:</strong> API call logs, processing costs, and feature usage within your account.</li>
      </ul>

      <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginTop: 32, marginBottom: 8 }}>3. How We Use Your Data</h2>
      <p>We use your data to:</p>
      <ul style={{ paddingLeft: 24 }}>
        <li>Provide and improve the SolarOps platform</li>
        <li>Generate AI-drafted email replies for your review</li>
        <li>Extract bill and NMI data from uploaded documents</li>
        <li>Track API usage and costs per account</li>
      </ul>
      <p>We do not sell your data to third parties. We do not use your data to train AI models.</p>

      <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginTop: 32, marginBottom: 8 }}>4. Google API Services — Limited Use Disclosure</h2>
      <p>SolarOps's use of information received from Google APIs adheres to the <a href="https://developers.google.com/terms/api-services-user-data-policy" style={{ color: '#4F8EF7' }}>Google API Services User Data Policy</a>, including the Limited Use requirements.</p>
      <p>Specifically:</p>
      <ul style={{ paddingLeft: 24 }}>
        <li>We only request access to Gmail data to provide the Inbox Assistant feature — reading emails and drafting replies on your behalf.</li>
        <li>We do not use Gmail data for advertising or to train machine learning models.</li>
        <li>We do not share Gmail data with third parties except as necessary to provide the service (e.g. sending to Anthropic's API for draft generation).</li>
        <li>You can revoke access at any time by disconnecting Gmail within SolarOps or via your Google Account settings.</li>
      </ul>

      <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginTop: 32, marginBottom: 8 }}>5. Data Storage</h2>
      <p>Your data is stored securely in Supabase (hosted on AWS in the ap-southeast-2 Sydney region). Email content synced from Gmail is stored in your account's database and is only accessible by authorised users in your organisation.</p>

      <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginTop: 32, marginBottom: 8 }}>6. Data Retention</h2>
      <p>We retain your data for as long as your account is active. You may request deletion of your data at any time by contacting hello@solarops.com.au. Upon account termination, data is deleted within 30 days.</p>

      <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginTop: 32, marginBottom: 8 }}>7. Third-Party Services</h2>
      <p>SolarOps uses the following third-party services to operate:</p>
      <ul style={{ paddingLeft: 24 }}>
        <li><strong>Anthropic (Claude API)</strong> — for AI draft generation and document analysis</li>
        <li><strong>Google Cloud Vision</strong> — for OCR processing of uploaded bills</li>
        <li><strong>Firebase</strong> — for authentication</li>
        <li><strong>Supabase</strong> — for database storage</li>
      </ul>

      <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginTop: 32, marginBottom: 8 }}>8. Your Rights</h2>
      <p>Under Australian Privacy law, you have the right to access, correct, or delete your personal information. To exercise these rights, contact hello@solarops.com.au.</p>

      <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginTop: 32, marginBottom: 8 }}>9. Changes to This Policy</h2>
      <p>We may update this policy from time to time. Material changes will be communicated by updating the effective date above.</p>

      <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginTop: 32, marginBottom: 8 }}>10. Contact</h2>
      <p>ONE AGENCY<br />hello@solarops.com.au<br />solarops.com.au</p>
    </div>
  );
}