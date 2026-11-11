import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ArtworkCard from "@/components/ArtworkCard";
import PageLoader from "@/components/PageLoader";
import SectionHeading from "@/components/SectionHeading";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function Account() {
    const { user } = useAuth();
    const [revelations, setRevelations] = useState([]);
    const [purchases, setPurchases] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [openingId, setOpeningId] = useState("");

    const loadAccount = async () => {
        const [myRevelations, myPurchases] = await Promise.all([api("/my/revelations"), api("/my/purchases")]);
        setRevelations(myRevelations);
        setPurchases(myPurchases);
    };

    useEffect(() => {
        let active = true;
        Promise.all([api("/my/revelations"), api("/my/purchases")])
            .then(([myRevelations, myPurchases]) => {
                if (!active) return;
                setRevelations(myRevelations);
                setPurchases(myPurchases);
            })
            .catch((requestError) => { if (active) setError(requestError.message); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, []);

    const openPiece = async (id) => {
        setOpeningId(id);
        setError("");
        try {
            await api(`/my/revelations/${encodeURIComponent(id)}/open`, { method: "POST" });
            await loadAccount();
        } catch (requestError) {
            setError(requestError.message);
        } finally {
            setOpeningId("");
        }
    };

    if (loading) return <PageLoader />;

    return (
        <main className="page-wrap">
            <SectionHeading
                eyebrow="Your collector's room"
                title={`Welcome, ${user?.name || "collector"}.`}
                description="A private record of the pieces and stories that have found their way to you."
            />
            {error && <div className="notice notice-error" role="alert" data-testid="account-error">{error}</div>}
            <section className="content-section content-section-flush">
                <div className="split-heading">
                    <div><p className="eyebrow">Unseal a story</p><h2 className="display-title">Your discoveries</h2></div>
                    <span className="eyebrow">{revelations.length} collected</span>
                </div>
                {revelations.length ? (
                    <div className="artwork-grid">
                        {revelations.map((item) => item.artwork && (
                            <div key={item.id}>
                                <ArtworkCard artwork={item.artwork} />
                                {!item.opened && (
                                    <button
                                        type="button"
                                        className="button button-small reveal-button"
                                        disabled={openingId === item.id}
                                        onClick={() => openPiece(item.id)}
                                        data-testid={`open-revelation-${item.id}`}
                                    >
                                        {openingId === item.id ? "Unsealing..." : "Unseal this piece"}
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="empty-panel" data-testid="discoveries-empty">
                        <p>Your first discovery is waiting in the <Link to="/exhibition/kutch-resonance">exhibition</Link>.</p>
                    </div>
                )}
            </section>
            <section className="content-section">
                <div className="split-heading">
                    <div><p className="eyebrow">Collected works</p><h2 className="display-title">Your purchases</h2></div>
                    <span className="eyebrow">{purchases.length} works</span>
                </div>
                {purchases.length ? (
                    <div className="artwork-grid">
                        {purchases.map((purchase) => purchase.artwork && <ArtworkCard key={purchase.id} artwork={purchase.artwork} />)}
                    </div>
                ) : (
                    <div className="empty-panel" data-testid="purchases-empty">
                        <p>Your collected works will be kept here.</p>
                    </div>
                )}
            </section>
        </main>
    );
}
