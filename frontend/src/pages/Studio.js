import { useEffect, useState } from "react";
import PageLoader from "@/components/PageLoader";
import SectionHeading from "@/components/SectionHeading";
import { api, formatPrice, mediaUrl } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const initialForm = { title: "", series_slug: "", kind: "craft", description: "", price: "", rarity: "common" };

export default function Studio() {
    const { user } = useAuth();
    const [series, setSeries] = useState([]);
    const [submissions, setSubmissions] = useState([]);
    const [form, setForm] = useState(initialForm);
    const [image, setImage] = useState(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    useEffect(() => {
        let active = true;
        Promise.all([api("/series"), api("/artist/submissions")])
            .then(([allSeries, allSubmissions]) => {
                if (!active) return;
                setSeries(allSeries);
                setSubmissions(allSubmissions);
                setForm((current) => ({ ...current, series_slug: current.series_slug || allSeries[0]?.slug || "" }));
            })
            .catch((requestError) => { if (active) setError(requestError.message); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, []);

    const submit = async (event) => {
        event.preventDefault();
        setError("");
        setMessage("");
        if (!image) {
            setError("Choose an image file for your submission.");
            return;
        }
        const body = new FormData();
        Object.entries(form).forEach(([key, value]) => body.append(key, value));
        body.append("image", image);
        setBusy(true);
        try {
            const created = await api("/artist/submissions", { method: "POST", body });
            setSubmissions((items) => [created, ...items]);
            setForm(initialForm);
            setImage(null);
            setMessage("Your work is with the curators for review.");
        } catch (requestError) {
            setError(requestError.message);
        } finally {
            setBusy(false);
        }
    };

    if (loading) return <PageLoader />;

    return (
        <main className="page-wrap">
            <SectionHeading
                eyebrow="The maker's studio"
                title={`Welcome, ${user?.name || "maker"}.`}
                description="Share a work and the practice behind it with the smolComp curators."
            />
            {error && <div className="notice notice-error" role="alert" data-testid="studio-error">{error}</div>}
            {message && <div className="notice notice-success" role="status" data-testid="studio-success">{message}</div>}

            {user?.status !== "approved" ? (
                <div className="empty-panel" data-testid="studio-pending">
                    <p className="eyebrow">Application under review</p>
                    <h2>Your studio is waiting for curation.</h2>
                    <p>Once a curator approves your maker account, you can submit work to a series.</p>
                </div>
            ) : (
                <section className="dashboard-layout">
                    <form className="panel-form" onSubmit={submit} data-testid="submission-form">
                        <p className="eyebrow">Offer a work</p>
                        <h2>Submit for curation</h2>
                        <label className="field"><span>Title</span><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required maxLength={160} data-testid="submission-title" /></label>
                        <label className="field"><span>Series</span>
                            <select value={form.series_slug} onChange={(e) => setForm({ ...form, series_slug: e.target.value })} required data-testid="submission-series">
                                {series.map((item) => <option key={item.slug} value={item.slug}>{item.title}</option>)}
                            </select>
                        </label>
                        <label className="field"><span>Craft or form</span><input value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} required data-testid="submission-kind" /></label>
                        <label className="field"><span>Story behind the work</span><textarea rows="4" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} data-testid="submission-description" /></label>
                        <label className="field"><span>Price (USD)</span><input type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required data-testid="submission-price" /></label>
                        <label className="field"><span>Rarity</span>
                            <select value={form.rarity} onChange={(e) => setForm({ ...form, rarity: e.target.value })} data-testid="submission-rarity">
                                <option value="common">Common</option><option value="rare">Rare</option><option value="secret">Secret</option>
                            </select>
                        </label>
                        <label className="field"><span>Artwork image (8 MB max)</span><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(e) => setImage(e.target.files?.[0] || null)} required data-testid="submission-image" /></label>
                        <button className="button" type="submit" disabled={busy || !series.length} data-testid="submission-submit">{busy ? "Sending for curation..." : "Send to curators"}</button>
                    </form>

                    <section className="dashboard-panel">
                        <div className="split-heading">
                            <div><p className="eyebrow">Your practice</p><h2 className="display-title">Submissions</h2></div>
                        </div>
                        {submissions.length ? (
                            <div className="submission-list">
                                {submissions.map((item) => (
                                    <article className="submission-row" key={item.id || item.title} data-testid={`submission-${item.id || item.title}`}>
                                        {item.image && <img src={mediaUrl(item.image)} alt="" />}
                                        <div><h3>{item.title}</h3><p>{item.description}</p><span className={`status-pill status-${item.status}`}>{item.status}</span></div>
                                        <strong>{formatPrice(item.price)}</strong>
                                    </article>
                                ))}
                            </div>
                        ) : <div className="empty-panel"><p>Your submitted works and review status will appear here.</p></div>}
                    </section>
                </section>
            )}
        </main>
    );
}
