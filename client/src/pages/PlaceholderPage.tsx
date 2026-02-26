import '../styles/PlaceholderPage.css';

interface PlaceholderPageProps {
  title: string;
}

export default function PlaceholderPage({ title }: PlaceholderPageProps) {
  return (
    <div className="placeholder-page">
      <div className="placeholder-card">
        <h1 className="placeholder-title">{title}</h1>
        <span className="coming-soon-badge">Coming soon</span>
      </div>
    </div>
  );
}
