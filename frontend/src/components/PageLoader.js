export default function PageLoader() {
    return (
        <div className="page-loader" role="status" aria-live="polite" data-testid="page-loader">
            <span className="loader-mark" aria-hidden="true">s</span>
            <span>Opening the gallery…</span>
        </div>
    );
}
