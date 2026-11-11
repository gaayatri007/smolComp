import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import PageLoader from "@/components/PageLoader";
import { api, mediaUrl } from "@/lib/api";

export default function PaymentResult({ success = false }) {
    const [searchParams] = useSearchParams();
    const sessionId = searchParams.get("session_id");
    const [result, setResult] = useState(null);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(Boolean(success && sessionId));

    useEffect(() => {
        if (!success || !sessionId) return undefined;
        let active = true;
        let attempts = 0;
        const checkStatus = async () => {
            try {
                const status = await api(`/payments/status/${encodeURIComponent(sessionId)}`);
                if (!active) return;
                setResult(status);
                setError("");
                if (status.payment_status === "paid" || attempts >= 4) {
                    setLoading(false);
                    return;
                }
                attempts += 1;
            } catch (requestError) {
                if (active) {
                    setError(requestError.message);
                    setLoading(false);
                }
            }
        };
        checkStatus();
        const timer = window.setInterval(() => {
            if (attempts < 5 && active) checkStatus();
        }, 2500);
        return () => {
            active = false;
            window.clearInterval(timer);
        };
    }, [success, sessionId]);

    if (loading) return <PageLoader />;

    return (
        <main className="page-wrap result-page">
            <p className="eyebrow">{success ? "A new piece of the story" : "The letter remains sealed"}</p>
            <h1 className="display-title">{success ? "Thank you for collecting." : "Checkout cancelled."}</h1>
            {!success ? (
                <p>Your payment was not completed. Nothing was charged; you can return to the collection whenever you are ready.</p>
            ) : error ? (
                <div className="notice notice-error" role="alert" data-testid="payment-error">{error}</div>
            ) : result?.payment_status === "paid" ? (
                <>
                    <p data-testid="payment-confirmation">Your payment for <strong>{result.item_label}</strong> is confirmed.</p>
                    {result.revealed?.length > 0 && (
                        <section className="reveal-grid" data-testid="payment-revealed-items">
                            {result.revealed.map((entry) => (
                                <article className="revealed-card" key={entry.revelation_id}>
                                    {entry.artwork.image && <img src={mediaUrl(entry.artwork.image)} alt={entry.artwork.title} />}
                                    <p className="eyebrow">{entry.rarity} discovery</p>
                                    <h2>{entry.artwork.title}</h2>
                                    <p>{entry.artwork.description}</p>
                                </article>
                            ))}
                        </section>
                    )}
                </>
            ) : result ? (
                <p data-testid="payment-pending">Your checkout is still processing. Your collector's room will update when it is confirmed.</p>
            ) : (
                <p data-testid="payment-missing-session">No checkout session was provided.</p>
            )}
            <div className="result-actions">
                <Link className="button" to="/account" data-testid="payment-account-link">Go to your collector's room</Link>
                <Link className="quiet-link" to="/exhibition/kutch-resonance">Return to the exhibition</Link>
            </div>
        </main>
    );
}
