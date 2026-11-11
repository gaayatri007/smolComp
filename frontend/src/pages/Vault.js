import { useEffect, useState } from "react";
import PageLoader from "@/components/PageLoader";
import SectionHeading from "@/components/SectionHeading";
import { api } from "@/lib/api";

export default function Vault() {
    const [vault, setVault] = useState({ secrets: [], secrets_found_by_collectors: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        let active = true;
        api("/vault")
            .then((data) => { if (active) setVault(data); })
            .catch((requestError) => { if (active) setError(requestError.message); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, []);

    if (loading) return <PageLoader />;

    return (
        <main className="page-wrap">
            <SectionHeading
                eyebrow="Behind the closed door"
                title="The secret vault"
                description="Some works are meant to be discovered, not displayed. Their makers have left clues in the dark."
            />
            {error && <div className="notice notice-error" role="alert" data-testid="vault-error">{error}</div>}
            <p className="vault-counter" data-testid="vault-counter">
                {vault.secrets_found_by_collectors} secret {vault.secrets_found_by_collectors === 1 ? "work" : "works"} discovered by collectors
            </p>
            {vault.secrets.length ? (
                <div className="vault-grid">
                    {vault.secrets.map((piece) => (
                        <article className="vault-card" key={piece.id} data-testid={`secret-${piece.id}`}>
                            <div className="vault-card-art"><span className="vault-sigil">✳</span><span className="eyebrow">SEALED WORK</span></div>
                            <div className="vault-card-copy">
                                <p className="eyebrow">{piece.kind} · {piece.artist_name}</p>
                                <h2>{piece.title}</h2>
                                <p>{piece.hint || "A story held back for the right moment."}</p>
                            </div>
                        </article>
                    ))}
                </div>
            ) : (
                <div className="empty-panel" data-testid="vault-empty">
                    <p className="eyebrow">The room is quiet</p>
                    <p>No secret works have been added to the vault yet.</p>
                </div>
            )}
        </main>
    );
}
