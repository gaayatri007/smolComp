import { formatPrice, mediaUrl } from "@/lib/api";

export default function ArtworkCard({ artwork, onBuy, actionLabel = "Add to basket" }) {
    const image = mediaUrl(artwork.image);
    return (
        <article className="artwork-card" data-testid={`artwork-${artwork.id || artwork.title}`}>
            <div className="artwork-image-wrap">
                {image ? (
                    <img className="artwork-image" src={image} alt={artwork.title} loading="lazy" />
                ) : (
                    <div className="artwork-placeholder" aria-label="Artwork image kept in the vault">
                        <span className="vault-symbol">✳</span>
                        <span>KEPT IN THE VAULT</span>
                    </div>
                )}
                <span className={`rarity-tag rarity-${artwork.rarity || "common"}`}>
                    {artwork.rarity || "common"}
                </span>
            </div>
            <div className="artwork-copy">
                <p className="eyebrow">{artwork.kind || "Craft"}{artwork.artist_name ? ` · ${artwork.artist_name}` : ""}</p>
                <h3>{artwork.title}</h3>
                <p>{artwork.description}</p>
                <div className="artwork-card-footer">
                    <span className="price-label">{formatPrice(artwork.price)}</span>
                    {onBuy && artwork.status !== "sold_out" && artwork.price != null && (
                        <button
                            type="button"
                            className="button button-small"
                            onClick={() => onBuy(artwork)}
                            data-testid={`buy-artwork-${artwork.id}`}
                        >
                            {actionLabel}
                        </button>
                    )}
                    {artwork.status === "sold_out" && <span className="sold-label">Collected</span>}
                </div>
            </div>
        </article>
    );
}
