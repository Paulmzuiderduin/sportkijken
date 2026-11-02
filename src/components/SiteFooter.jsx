const CONTACT_EMAIL = 'info@paulzuiderduin.com';
const CONTACT_MAILTO_URL = `mailto:${CONTACT_EMAIL}`;

export default function SiteFooter({ emailCopied, onCopyEmail }) {
  return (
    <footer className="site-footer">
      <a href="/privacy-policy.html">Privacy</a>
      <a href={CONTACT_MAILTO_URL}>Contact</a>
      <a href="https://ko-fi.com/Y8Y41QY1SE" target="_blank" rel="noreferrer">Support op Ko-fi</a>
      <button type="button" onClick={onCopyEmail}>
        {emailCopied ? 'E-mailadres gekopieerd' : 'Kopieer e-mailadres'}
      </button>
    </footer>
  );
}
