import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ArtworkCard from "@/components/ArtworkCard";
import PageLoader from "@/components/PageLoader";
import { api, formatPrice, mediaUrl } from "@/lib/api";
import { useCart } from "@/context/CartContext";

export default function Home() {
    const [content, setContent] = useState({ seasons: [], series: [], boxes: [], artworks: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const { addItem } = useCart();

    useEffect(() => {
        let active = true;
        Promise.all([api("/seasons"), api("/series"), api("/boxes"), api("/artworks?season=kutch-resonance")])
            .then(([seasons, series, boxes, artworks]) => {
                if (active) setContent({ seasons, series, boxes, artworks });
            })
            .catch((requestError) => {
                if (active) setError(requestError.message);
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => { active = false; };
    }, []);

    const liveSeason = content.seasons.find((season) => season.status === "live");
    const featuredSeries = content.series.filter((series) => series.season_slug === liveSeason?.slug).slice(0, 3);

    const addBox = (box) => {
        addItem({
            id: box.id,
            type: "box",
            name: box.name || "Seasonal Blind Box",
            image: box.image,
            price: box.price,
        });
    };

    const addArtwork = (artwork) => {
        addItem({
            id: artwork.id,
            type: "artwork",
            name: artwork.title,
            kind: artwork.kind,
            artist: artwork.artist_name,
            image: artwork.image,
            price: artwork.price,
        });
    };

    if (loading) return <PageLoader />;

    return (
        <main>
            <section className="home-hero spotlight">
                <div className="hero-copy">
                    <p className="eyebrow">A living archive of Indian craft</p>
                    <h1 className="hero-title">Small worlds.<br /><em>Made by hand.</em></h1>
                    <p className="hero-description">
                        Each season, we follow a thread into a place, meet the makers who keep it alive,
                        and bring a small piece of that story to your door.
                    </p>
                    <div className="hero-actions">
                        <Link className="button" to="/exhibition/kutch-resonance" data-testid="home-exhibition-link">
                            Enter the exhibition
                        </Link>
                        <Link className="quiet-link" to="/vault" data-testid="home-vault-link">
                            Find the unspoken <span aria-hidden="true">↗</span>
                        </Link>
                    </div>
                    <div className="hero-caption">
                        <span className="eyebrow">01 / CURRENT LETTER</span>
                        <span>{liveSeason ? `${liveSeason.region} · ${liveSeason.country}` : "Kutch, Gujarat, India"}</span>
                    </div>
                </div>
                <div className="hero-art" role="img" aria-label="A handmade artifact in a dark gallery">
                    {liveSeason?.hero_image && <img src={mediaUrl(liveSeason.hero_image)} alt="" />}
                    <div className="hero-art-label">
                        <span className="eyebrow">SEASON I</span>
                        <strong>{liveSeason?.title || "Kutch Resonance"}</strong>
                        <span>Gujarat, India</span>
                    </div>
                </div>
                <span className="hero-index">smol / 01</span>
            </section>

            {error && <div className="notice notice-error" role="alert" data-testid="home-load-error">{error}</div>}
            <section className="marquee-band" aria-label="Craft traditions">
                <div className="marquee-track">
                    {["Ajrakh block print", "Rabari embroidery", "Rogan oil painting", "Bell metal craft", "Kutch clay"].map((craft) => (
                        <span key={craft}>{craft}<i aria-hidden="true"> · </i></span>
                    ))}
                </div>
            </section>

            <section className="content-section">
                <div className="split-heading">
                    <div>
                        <p className="eyebrow">The current season</p>
                        <h2 className="display-title">{liveSeason?.title || "Kutch Resonance"}</h2>
                    </div>
                    <p className="section-description">
                        {liveSeason?.description || "A season of block print, thread, oil, metal and clay from Kutch."}
                    </p>
                </div>
                {featuredSeries.length ? (
                    <div className="series-grid">
                        {featuredSeries.map((item, index) => (
                            <Link
                                to={`/exhibition/${liveSeason.slug}`}
                                className={`series-tile series-tile-${index + 1}`}
                                key={item.slug}
                                data-testid={`series-${item.slug}`}
                            >
                                {item.cover_image && <img src={mediaUrl(item.cover_image)} alt="" loading="lazy" />}
                                <span className="series-tile-copy">
                                    <span className="eyebrow">{item.craft}</span>
                                    <strong>{item.title}</strong>
                                    <span>{item.description}</span>
                                </span>
                            </Link>
                        ))}
                    </div>
                ) : (
                    <div className="empty-panel" data-testid="series-empty">
                        <p className="eyebrow">The gallery is being prepared</p>
                        <p>No exhibition entries are available yet. Check back when the collection is published.</p>
                    </div>
                )}
            </section>

            <section className="makers-invitation">
                <p className="eyebrow">Every piece begins with a person</p>
                <h2 className="display-title">Meet the makers behind the work.</h2>
                <p>Visit the studios, learn the practices, and hear the stories carried from one generation to the next.</p>
                <Link className="button button-quiet" to="/artists">About the artists</Link>
            </section>

            <section className="content-section content-section-muted">
                <div className="split-heading">
                    <div>
                        <p className="eyebrow">A little mystery</p>
                        <h2 className="display-title">The blind box</h2>
                    </div>
                    <p className="section-description">
                        A sealed letter from the season. Each box holds one work selected from the collection.
                    </p>
                </div>
                {content.boxes.length ? (
                    <div className="box-grid">
                        {content.boxes.slice(0, 3).map((box) => (
                            <article className="box-card" key={box.id} data-testid={`box-${box.id}`}>
                                <div className="box-card-art">
                                    {box.image ? <img src={mediaUrl(box.image)} alt="" loading="lazy" /> : <span aria-hidden="true">01</span>}
                                    <span className="box-seal">SEALED</span>
                                </div>
                                <div className="box-card-copy">
                                    <p className="eyebrow">A Kutch letter</p>
                                    <h3>{box.name || "Seasonal Blind Box"}</h3>
                                    <p>Common 60% · Rare 30% · Secret 10%</p>
                                    <div className="box-card-footer">
                                        <strong>{formatPrice(box.price)}</strong>
                                        <button className="button button-small" type="button" onClick={() => addBox(box)} data-testid={`buy-box-${box.id}`}>
                                            Add to basket
                                        </button>
                                    </div>
                                </div>
                            </article>
                        ))}
                    </div>
                ) : (
                    <div className="empty-panel" data-testid="boxes-empty">
                        <p>No boxes are available in this season right now.</p>
                    </div>
                )}
            </section>

            <section className="content-section">
                <div className="split-heading">
                    <div>
                        <p className="eyebrow">Collected by the gallery</p>
                        <h2 className="display-title">Selected works</h2>
                    </div>
                    <Link to="/exhibition/kutch-resonance" className="quiet-link">View the exhibition ↗</Link>
                </div>
                {content.artworks.length ? (
                    <div className="artwork-grid">
                        {content.artworks.slice(0, 3).map((artwork) => (
                            <ArtworkCard key={artwork.id} artwork={artwork} onBuy={addArtwork} />
                        ))}
                    </div>
                ) : (
                    <div className="empty-panel" data-testid="artworks-empty">
                        <p>Selected works will appear here as the season is curated.</p>
                    </div>
                )}
            </section>
        </main>
    );
}
