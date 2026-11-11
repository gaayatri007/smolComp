import { Link } from "react-router-dom";

export default function Footer() {
    return (
        <footer className="site-footer">
            <div className="site-footer-inner">
                <Link to="/" className="brand-lockup" aria-label="smolComp home">
                    <span className="brand-mark">s</span>
                    <span>smolComp</span>
                </Link>
                <p>Seasonal letters from the makers of Kutch.</p>
                <span className="font-mono text-xs text-ink3">MADE WITH CARE · INDIA</span>
            </div>
        </footer>
    );
}
