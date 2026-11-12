/**
 * The fan of cards above the search result: three sheets of the student's selection, face
 * hidden. Purely decorative and empty by construction: no title, no employer and no count
 * ever reaches it (C88, C104).
 */
export function ResultStack() {
  return (
    <div className="result-stack" aria-hidden>
      {[0, 1, 2].map((card) => (
        <div key={card} className="result-card" data-card={card}>
          <span className="result-card-mark" />
          <span className="result-card-line" />
          <span className="result-card-line" data-short />
          <span className="result-card-chips">
            <i />
            <i />
          </span>
        </div>
      ))}
      <span className="result-sticker">✓</span>
    </div>
  );
}
