import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ArtworkCard from "@/components/ArtworkCard";
import PageLoader from "@/components/PageLoader";
import { api, formatPrice, mediaUrl } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function Exhibition() {
    const { slug } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [season, setSeason] = useState(null);
    const [series, setSeries] = useState([]);
    const [artworks, setArtworks] = useState([]);
    const [boxes, setBoxes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [actionError, setActionError] = useState("");

    useEffect(() => {
        let active = true;
        Promise.all([
            api(`/seasons/${encodeURIComponent(slug)}`),
            api(`/artworks?season=${encodeURIComponent(slug)}`),
            api("/boxes"),
        ])
            .then(([seasonData, seasonArtworks, allBoxes]) => {
                if (!active) return;
                setSeason(seasonData.season);
                setSeries(seasonData.series || []);
                setArtworks(seasonArtworks || []);
                const seriesSlugs = new Set((seasonData.series || []).map((item) => item.slug));
                setBoxes((allBoxes || []).filter((box) => seriesSlugs.has(box.series_slug)));
            })
            .catch((requestError) => {
                if (active) setError(requestError.message);
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => { active = false; };
    }, [slug]);

    const buyArtwork = async (artwork) => {
        if (!user || user === false) {
            navigate("/login/customer");
            return;
        }
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

    const buyBox = async (box) => {
        if (!user || user === false) {
            navigate("/login/customer");
            return;
        }
        setActionError("");
        try {
            const result = await api("/payments/checkout", {
                method: "POST",
                body: JSON.stringify({ box_id: box.id, origin_url: window.location.origin, quantity: 1 }),
            });
            window.location.assign(result.checkout_url);
        } catch (requestError) {
            setActionError(requestError.message);
        }
    };

    if (loading) return <PageLoader />;

    return (
        <main className="page-wrap">
            {error ? (
                <div className="notice notice-error" role="alert" data-testid="exhibition-error">{error}</div>
            ) : !season ? (
                <div className="empty-panel"><h1>This season could not be found.</h1></div>
            ) : (
                <>
                    <section className="season-banner">
                        {season.hero_image && <img src={mediaUrl(season.hero_image)} alt="" />}
                        <div className="season-banner-shade" />
                        <div className="season-banner-copy">
                            <p className="eyebrow">Season {String(season.number).padStart(2, "0")} · {season.region}</p>
                            <h1 className="display-title">{season.title}</h1>
                            <p>{season.description}</p>
                            <span className="season-status">{season.status} season</span>
                        </div>
                    </section>
                    {actionError && <div className="notice notice-error" role="alert">{actionError}</div>}

                    <section className="content-section content-section-flush">
                        <div className="split-heading">
                            <div><p className="eyebrow">The makers and their methods</p><h2 className="display-title">Series in this season</h2></div>
                        </div>
                        {series.length ? (
                            <div className="series-list">
                                {series.map((item) => (
                                    <article className="series-row" key={item.slug} data-testid={`series-row-${item.slug}`}>
                                        {item.cover_image && <img src={mediaUrl(item.cover_image)} alt="" loading="lazy" />}
                                        <div><p className="eyebrow">{item.craft}</p><h3>{item.title}</h3><p>{item.description}</p></div>
                                    </article>
                                ))}
                            </div>
                        ) : <div className="empty-panel"><p>No series have been published for this season.</p></div>}
                    </section>

                    <section className="content-section content-section-muted">
                        <div className="split-heading">
                            <div><p className="eyebrow">The collection</p><h2 className="display-title">Works from the season</h2></div>
                            <span className="eyebrow">{artworks.length} works</span>
                        </div>
                        {artworks.length ? (
                            <div className="artwork-grid">
                                {artworks.map((artwork) => <ArtworkCard key={artwork.id} artwork={artwork} onBuy={buyArtwork} />)}
                            </div>
                        ) : <div className="empty-panel"><p>The collection is being curated. Please return soon.</p></div>}
                    </section>

                    {boxes.length > 0 && (
                        <section className="content-section">
                            <div className="split-heading">
                                <div><p className="eyebrow">A sealed piece of the season</p><h2 className="display-title">Blind boxes</h2></div>
                            </div>
                            <div className="box-grid">
                                {boxes.map((box) => (
                                    <article className="box-card" key={box.id}>
                                        <div className="box-card-art">{box.image ? <img src={mediaUrl(box.image)} alt="" /> : <span>01</span>}</div>
                                        <div className="box-card-copy">
                                            <h3>{box.name}</h3><p>{formatPrice(box.price)} · Common, rare, or secret</p>
                                            <button className="button button-small" onClick={() => buyBox(box)} type="button" data-testid={`exhibition-buy-box-${box.id}`}>Open a box</button>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        </section>
                    )}
                </>
            )}
        </main>
    );
}
