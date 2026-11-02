export default function ConsentDialog({ onConsent }) {
  return (
    <div className="consent-modal" role="presentation">
      <section className="consent-dialog" aria-labelledby="sportkijken-consent-title" aria-describedby="sportkijken-consent-copy">
        <p className="kicker">Privacy</p>
        <h2 id="sportkijken-consent-title">Optionele analytics</h2>
        <p id="sportkijken-consent-copy">
          We gebruiken optionele, geanonimiseerde Google Analytics-statistieken om te zien welke sporten en
          zenders het meest worden bekeken. Analytics start alleen als je toestemming geeft.
        </p>
        <div className="consent-actions">
          <button
            type="button"
            className="ghost"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onConsent('denied');
            }}
          >
            Niet toestaan
          </button>
          <button
            type="button"
            className="primary"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onConsent('granted');
            }}
          >
            Toestaan
          </button>
        </div>
      </section>
    </div>
  );
}
