import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import ArtworkCard from "@/components/ArtworkCard";
import PageLoader from "@/components/PageLoader";
import SectionHeading from "@/components/SectionHeading";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function Timeless() {
    const [artworks, setArtworks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [actionError, setActionError] = useState("");
    const { user } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        let active = true;
        api("/artworks?timeless=true")
            .then((items) => { if (active) setArtworks(items); })
            .catch((requestError) => { if (active) setError(requestError.message); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, []);

    const buy = async (artwork) => {
        if (!user || user === false) return navigate("/login/customer");
        setActionError("");
        try {
            const result = await api("/payments/checkout", {
                method: "POST",
                body: JSON.stringify({ artwork_id: artwork.id, origin_url: window.location.origin, quantity: 1 }),
            });
            window.location.assign(result.checkout_url);
        } catch (requestError) {
            setActionError(requestError.message);
        }
    };

    if (loading) return <PageLoader />;

    return (
        <main className="page-wrap">
            <SectionHeading
                eyebrow="Work that stays"
                title="The timeless collection"
                description="A small, continuing collection of pieces whose makers have chosen to keep in the light."
            />
            {error && <div className="notice notice-error" role="alert" data-testid="timeless-error">{error}</div>}
            {actionError && <div className="notice notice-error" role="alert">{actionError}</div>}
            {artworks.length ? (
                <div className="artwork-grid">
                    {artworks.map((artwork) => <ArtworkCard key={artwork.id} artwork={artwork} onBuy={buy} />)}
                </div>
            ) : (
                <div className="empty-panel" data-testid="timeless-empty">
                    <p className="eyebrow">A collection in the making</p>
                    <p>There are no timeless works available at the moment.</p>
                </div>
            )}
        </main>
    );
}
