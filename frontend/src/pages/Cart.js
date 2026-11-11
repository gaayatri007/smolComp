import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import SectionHeading from "@/components/SectionHeading";
import { useCart } from "@/context/CartContext";
import { formatPrice, mediaUrl } from "@/lib/api";

export default function Cart() {
    const { items, removeItem, setQuantity, clearCart } = useCart();
    const [notice, setNotice] = useState("");
    const total = useMemo(
        () => items.reduce((sum, item) => sum + Number(item.price || 0) * (item.quantity || 1), 0),
        [items],
    );

    return (
        <main className="page-wrap">
            <SectionHeading
                eyebrow="Collected, for now"
                title="Your basket."
                description="Keep a small list of the pieces you want to return to. Your basket is saved in this browser."
            />
            {notice && <div className="notice notice-info" role="status">{notice}</div>}
            {items.length ? (
                <>
                    <section className="cart-list" aria-label="Items in your basket">
                        {items.map((item) => (
                            <article className="cart-row" key={`${item.type}:${item.id}`}>
                                <div className="cart-thumbnail">
                                    {item.image
                                        ? <img src={mediaUrl(item.image)} alt="" />
                                        : <span aria-hidden="true">✳</span>}
                                </div>
                                <div className="cart-copy">
                                    <p className="eyebrow">{item.type === "box" ? "Seasonal box" : item.kind || "Artwork"}</p>
                                    <h2>{item.name}</h2>
                                    <p>{item.artist ? `By ${item.artist}` : "A piece from the collection"}</p>
                                </div>
                                <div className="cart-controls">
                                    {item.type === "box" ? (
                                        <label className="cart-quantity">
                                            <span>Quantity</span>
                                            <input
                                                aria-label={`Quantity for ${item.name}`}
                                                type="number"
                                                min="1"
                                                max="10"
                                                value={item.quantity || 1}
                                                onChange={(event) => setQuantity(item.id, item.type, event.target.value)}
                                            />
                                        </label>
                                    ) : <span className="cart-quantity-label">One of a kind</span>}
                                    <strong>{formatPrice(Number(item.price || 0) * (item.quantity || 1))}</strong>
                                    <button className="text-button cart-remove" type="button" onClick={() => removeItem(item.id, item.type)}>
                                        Remove
                                    </button>
                                </div>
                            </article>
                        ))}
                    </section>
                    <section className="cart-summary">
                        <div>
                            <p className="eyebrow">Basket total</p>
                            <strong>{formatPrice(total)}</strong>
                        </div>
                        <div className="cart-summary-actions">
                            <button className="button button-quiet" type="button" onClick={clearCart}>Clear basket</button>
                            <button
                                className="button"
                                type="button"
                                onClick={() => setNotice("Checkout is paused for this free demo. No payment will be taken; the basket is here to preview the collector experience.")}
                                data-testid="cart-checkout"
                            >
                                Continue to checkout
                            </button>
                        </div>
                    </section>
                    <p className="cart-payment-note">Checkout is not enabled yet. Payments require a separately configured Stripe test account.</p>
                </>
            ) : (
                <div className="empty-panel cart-empty">
                    <p className="eyebrow">Nothing collected yet</p>
                    <h2>A good story can wait here.</h2>
                    <p>Add a piece or a seasonal box from the exhibition. It will stay in this browser's basket.</p>
                    <Link className="button" to="/exhibition/kutch-resonance">Browse the collection</Link>
                </div>
            )}
        </main>
    );
}
