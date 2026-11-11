import { useCallback, useEffect, useState } from "react";
import PageLoader from "@/components/PageLoader";
import SectionHeading from "@/components/SectionHeading";
import { api, formatPrice } from "@/lib/api";

const emptyData = { overview: {}, users: [], submissions: [], series: [] };

export default function Admin() {
    const [data, setData] = useState(emptyData);
    const [seriesChoices, setSeriesChoices] = useState({});
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState("");
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    const loadAdmin = useCallback(async () => {
        const [overview, users, submissions, series] = await Promise.all([
            api("/admin/overview"),
            api("/admin/users"),
            api("/admin/submissions?status=pending"),
            api("/series"),
        ]);
        setData({ overview, users, submissions, series });
    }, []);

    useEffect(() => {
        let active = true;
        loadAdmin()
            .catch((requestError) => { if (active) setError(requestError.message); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [loadAdmin]);

    const setArtistStatus = async (artist, status) => {
        const id = artist._id || artist.id;
        if (!id) {
            setError("This artist record has no ID; refresh the admin list and try again.");
            return;
        }
        setBusy(id);
        setError("");
        setMessage("");
        try {
            await api(`/admin/users/${encodeURIComponent(id)}/status`, {
                method: "POST",
                body: JSON.stringify({ status }),
            });
            await loadAdmin();
            setMessage(`Artist ${status}.`);
        } catch (requestError) {
            setError(requestError.message);
        } finally {
            setBusy("");
        }
    };

    const decideSubmission = async (submission, status) => {
        const id = submission.id || submission._id;
        if (!id) {
            setError("This submission record has no ID; refresh the admin list and try again.");
            return;
        }
        const series_slug = seriesChoices[id] || submission.series_slug || "";
        if (status === "approved" && !series_slug) {
            setError("Choose a series before approving this submission.");
            return;
        }
        setBusy(id);
        setError("");
        setMessage("");
        try {
            await api(`/admin/submissions/${encodeURIComponent(id)}/decision`, {
                method: "POST",
                body: JSON.stringify({ status, series_slug }),
            });
            await loadAdmin();
            setMessage(`Submission ${status}.`);
        } catch (requestError) {
            setError(requestError.message);
        } finally {
            setBusy("");
        }
    };

    if (loading) return <PageLoader />;

    const metrics = [
        ["Paid orders", data.overview.paid_orders ?? 0],
        ["Revenue", formatPrice(data.overview.revenue_usd ?? 0)],
        ["Pending makers", data.overview.pending_artists ?? 0],
        ["Works submitted", data.overview.pending_submissions ?? 0],
        ["Boxes opened", data.overview.boxes_opened ?? 0],
        ["Community votes", data.overview.total_votes ?? 0],
    ];
    const pendingArtists = data.users.filter((person) => person.role === "artist" && person.status === "pending");

    return (
        <main className="page-wrap">
            <SectionHeading
                eyebrow="Curator's desk"
                title="Care for the collection."
                description="Review maker applications and submissions, and keep an eye on the season."
            />
            {error && <div className="notice notice-error" role="alert" data-testid="admin-error">{error}</div>}
            {message && <div className="notice notice-success" role="status" data-testid="admin-success">{message}</div>}
            <section className="metrics-grid" aria-label="Gallery overview" data-testid="admin-metrics">
                {metrics.map(([label, value]) => (
                    <article className="metric-card" key={label}>
                        <span className="eyebrow">{label}</span>
                        <strong>{value}</strong>
                    </article>
                ))}
            </section>

            <section className="content-section content-section-flush">
                <div className="split-heading">
                    <div><p className="eyebrow">New voices</p><h2 className="display-title">Maker applications</h2></div>
                    <span className="eyebrow">{pendingArtists.length} awaiting review</span>
                </div>
                {pendingArtists.length ? (
                    <div className="review-list">
                        {pendingArtists.map((artist) => (
                            <article className="review-card" key={artist.id} data-testid={`artist-review-${artist.id}`}>
                                <div><p className="eyebrow">{artist.region || "Region not given"} · {artist.craft || "Practice not given"}</p><h3>{artist.name}</h3><p>{artist.email}</p></div>
                                <div className="review-actions">
                                    <button className="button button-small" disabled={busy === artist.id} onClick={() => setArtistStatus(artist, "approved")} type="button" data-testid={`approve-artist-${artist.id}`}>Approve</button>
                                    <button className="button button-quiet button-small" disabled={busy === artist.id} onClick={() => setArtistStatus(artist, "rejected")} type="button" data-testid={`reject-artist-${artist.id}`}>Decline</button>
                                </div>
                            </article>
                        ))}
                    </div>
                ) : <div className="empty-panel"><p>No maker applications are waiting for review.</p></div>}
            </section>

            <section className="content-section">
                <div className="split-heading">
                    <div><p className="eyebrow">Works sent for consideration</p><h2 className="display-title">Submission review</h2></div>
                    <span className="eyebrow">{data.submissions.length} pending</span>
                </div>
                {data.submissions.length ? (
                    <div className="review-list">
                        {data.submissions.map((submission) => (
                            <article className="review-card submission-review" key={submission.id} data-testid={`admin-submission-${submission.id}`}>
                                <div>
                                    <p className="eyebrow">{submission.artist_name} · {submission.artist_craft || submission.kind}</p>
                                    <h3>{submission.title}</h3>
                                    <p>{submission.description}</p>
                                    <strong>{formatPrice(submission.price)}</strong>
                                </div>
                                <div className="review-actions review-actions-stack">
                                    <label className="field"><span>Place in series</span>
                                        <select value={seriesChoices[submission.id] || submission.series_slug || ""} onChange={(event) => setSeriesChoices((current) => ({ ...current, [submission.id]: event.target.value }))} data-testid={`submission-series-${submission.id}`}>
                                            <option value="">Choose a series</option>
                                            {data.series.map((series) => <option key={series.slug} value={series.slug}>{series.title}</option>)}
                                        </select>
                                    </label>
                                    <button className="button button-small" disabled={busy === submission.id} onClick={() => decideSubmission(submission, "approved")} type="button" data-testid={`approve-submission-${submission.id}`}>Approve work</button>
                                    <button className="button button-quiet button-small" disabled={busy === submission.id} onClick={() => decideSubmission(submission, "rejected")} type="button" data-testid={`reject-submission-${submission.id}`}>Decline</button>
                                </div>
                            </article>
                        ))}
                    </div>
                ) : <div className="empty-panel"><p>No works are awaiting curation.</p></div>}
            </section>
        </main>
    );
}
