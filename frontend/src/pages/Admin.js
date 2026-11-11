import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, formatPrice, mediaUrl } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import PageLoader from "@/components/PageLoader";

const EMPTY_ADMIN_DATA = {
    overview: {},
    users: [],
    submissions: [],
    seasons: [],
    series: [],
    artworks: [],
    boxes: [],
    polls: [],
};

function Admin() {
    const { user, loading } = useAuth();
    const [data, setData] = useState(EMPTY_ADMIN_DATA);
    const [pageLoading, setPageLoading] = useState(true);
    const [busy, setBusy] = useState("");
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [userSearch, setUserSearch] = useState("");
    const [roleFilter, setRoleFilter] = useState("all");
    const [demoCredentials, setDemoCredentials] = useState([]);

    const loadAdminData = useCallback(async (showLoading = false) => {
        if (showLoading) setPageLoading(true);
        try {
            const [overview, users, submissions, seasons, series, artworks, boxes, polls] = await Promise.all([
                api("/admin/overview"),
                api("/admin/users"),
                api("/admin/submissions"),
                api("/admin/seasons"),
                api("/admin/series"),
                api("/admin/artworks"),
                api("/admin/boxes"),
                api("/admin/polls"),
            ]);
            setData({ overview, users, submissions, seasons, series, artworks, boxes, polls });
            setError("");
        } catch (requestError) {
            setError(requestError.message);
        } finally {
            setPageLoading(false);
        }
    }, []);

    useEffect(() => {
        if (user?.role === "admin") loadAdminData(true);
    }, [user, loadAdminData]);

    useEffect(() => {
        if (user?.role !== "admin") return undefined;
        const timer = window.setInterval(() => loadAdminData(), 15000);
        return () => window.clearInterval(timer);
    }, [user, loadAdminData]);

    const filteredUsers = useMemo(() => {
        const query = userSearch.trim().toLowerCase();
        return data.users.filter((item) => {
            const matchesRole = roleFilter === "all" || item.role === roleFilter;
            const matchesSearch = !query || [item.name, item.email, item.role, item.status]
                .some((value) => String(value || "").toLowerCase().includes(query));
            return matchesRole && matchesSearch;
        });
    }, [data.users, roleFilter, userSearch]);

    const updateUserStatus = async (item, status) => {
        setBusy(`user-${item.id}`);
        setError("");
        try {
            await api(`/admin/users/${item.id}/status`, {
                method: "POST",
                body: JSON.stringify({ status }),
            });
            setNotice(`${item.name || item.email} is now ${status}.`);
            await loadAdminData();
        } catch (requestError) {
            setError(requestError.message);
        } finally {
            setBusy("");
        }
    };

    const decideSubmission = async (item, status) => {
        setBusy(`submission-${item.id}`);
        setError("");
        try {
            await api(`/admin/submissions/${item.id}/decision`, {
                method: "PATCH",
                body: JSON.stringify({ status }),
            });
            setNotice(`Submission ${status}.`);
            await loadAdminData();
        } catch (requestError) {
            setError(requestError.message);
        } finally {
            setBusy("");
        }
    };

    const seedDemoCollection = async () => {
        setBusy("seed");
        setError("");
        setNotice("");
        setDemoCredentials([]);
        try {
            const result = await api("/admin/demo/seed", { method: "POST" });
            setDemoCredentials(result.new_demo_accounts || []);
            setNotice(result.message || "Sample seasons, artworks, polls, and artist accounts are ready.");
            await loadAdminData();
        } catch (requestError) {
            setError(requestError.message);
        } finally {
            setBusy("");
        }
    };

    const submitContent = async (event, endpoint, getPayload, successMessage) => {
        event.preventDefault();
        const form = event.currentTarget;
        const formId = form.dataset.form;
        setBusy(formId);
        setError("");
        setNotice("");
        try {
            await api(endpoint, {
                method: "POST",
                body: JSON.stringify(getPayload(new FormData(form))),
            });
            form.reset();
            setNotice(successMessage);
            await loadAdminData();
        } catch (requestError) {
            setError(requestError.message);
        } finally {
            setBusy("");
        }
    };

    const togglePoll = async (poll) => {
        setBusy(`poll-${poll.id}`);
        setError("");
        try {
            await api(`/admin/polls/${poll.id}/active`, {
                method: "PATCH",
                body: JSON.stringify({ active: !poll.active }),
            });
            setNotice(`Poll ${poll.active ? "paused" : "activated"}.`);
            await loadAdminData();
        } catch (requestError) {
            setError(requestError.message);
        } finally {
            setBusy("");
        }
    };

    const toggleBox = async (box) => {
        setBusy(`box-${box.id}`);
        setError("");
        try {
            await api(`/admin/boxes/${box.id}/active`, {
                method: "PATCH",
                body: JSON.stringify({ active: !box.active }),
            });
            setNotice(`Blind box ${box.active ? "paused" : "activated"}.`);
            await loadAdminData();
        } catch (requestError) {
            setError(requestError.message);
        } finally {
            setBusy("");
        }
    };

    const toggleSeason = async (season) => {
        const status = season.status === "live" ? "upcoming" : "live";
        setBusy(`season-${season.slug}`);
        setError("");
        try {
            await api(`/admin/seasons/${season.slug}/status`, {
                method: "PATCH",
                body: JSON.stringify({ status }),
            });
            setNotice(`${season.title} is now ${status}.`);
            await loadAdminData();
        } catch (requestError) {
            setError(requestError.message);
        } finally {
            setBusy("");
        }
    };

    const copyCredentials = async () => {
        const text = demoCredentials.map(({ email, password }) => `${email}\t${password}`).join("\n");
        try {
            await navigator.clipboard.writeText(text);
            setNotice("Demo logins copied to the clipboard. Save them somewhere private; they are shown only once.");
        } catch {
            setError("Could not access the clipboard. Copy the demo login details from the panel.");
        }
    };

    if (loading || pageLoading) return <PageLoader />;
    if (!user || user.role !== "admin") {
        return (
            <div className="page-wrap">
                <section className="empty-panel">
                    <p className="eyebrow">Curator access</p>
                    <h1 className="display-title">This studio is private.</h1>
                    <p>Sign in with an administrator account to manage the gallery.</p>
                    <Link to="/login/admin" className="button">Admin sign in</Link>
                </section>
            </div>
        );
    }

    return (
        <div className="container page-shell admin-page">
            <header className="page-header admin-header">
                <div>
                    <p className="eyebrow">The curator studio</p>
                    <h1 className="display-title">Gallery management</h1>
                    <p>Review people and submissions, shape each season, and keep the public gallery current.</p>
                </div>
                <button className="button button-quiet" onClick={() => loadAdminData(true)} disabled={Boolean(busy)} type="button">
                    Refresh now
                </button>
            </header>

            {error && <div className="notice notice-error" role="alert">{error}</div>}
            {notice && <div className="notice notice-success" role="status">{notice}</div>}

            <section className="admin-metrics" aria-label="Gallery overview">
                <div className="metric-card"><span>People</span><strong>{data.overview.total_users ?? data.users.length}</strong></div>
                <div className="metric-card"><span>Artists waiting</span><strong>{data.overview.pending_artists ?? data.users.filter((item) => item.role === "artist" && item.status === "pending").length}</strong></div>
                <div className="metric-card"><span>Submissions</span><strong>{data.overview.pending_submissions ?? data.submissions.filter((item) => item.status === "pending").length}</strong></div>
                <div className="metric-card"><span>Seasons</span><strong>{data.seasons.length}</strong></div>
            </section>
            <p className="admin-refresh-note">People, artists, and gallery activity refresh automatically every 15 seconds.</p>

            <section className="admin-section">
                <div className="admin-section-heading">
                    <div><p className="eyebrow">Starter collection</p><h2>Make the gallery feel alive</h2></div>
                    <button className="button" type="button" onClick={seedDemoCollection} disabled={Boolean(busy)}>
                        {busy === "seed" ? "Preparing..." : "Set up sample seasons & artists"}
                    </button>
                </div>
                <p>Creates the bundled sample seasons, artwork, blind boxes, polls, approved artist previews, and a customer preview account. Existing records are left in place. New passwords are generated securely and displayed to you once.</p>
                {demoCredentials.length > 0 && (
                    <div className="demo-credentials" role="status">
                        <div className="admin-section-heading">
                            <h3>New sample artist logins</h3>
                            <button type="button" className="button button-small button-quiet" onClick={copyCredentials}>Copy logins</button>
                        </div>
                        <p>Save these credentials now. They will disappear when you leave or refresh this page.</p>
                        <ul>
                            {demoCredentials.map((account) => (
                                <li key={account.email}><strong>{account.name} · {account.role}</strong><span>{account.email}</span><code>{account.password}</code></li>
                            ))}
                        </ul>
                    </div>
                )}
            </section>

            <section className="admin-section">
                <div className="admin-section-heading">
                    <div><p className="eyebrow">Community</p><h2>People and artist accounts</h2></div>
                    <span className="admin-result-count">{filteredUsers.length} of {data.users.length}</span>
                </div>
                <div className="admin-user-filters">
                    <label className="admin-search">Search people
                        <input value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder="Name, email, role, or status" />
                    </label>
                    <label>Role
                        <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
                            <option value="all">Everyone</option>
                            <option value="customer">Customers</option>
                            <option value="artist">Artists</option>
                            <option value="admin">Admins</option>
                        </select>
                    </label>
                </div>
                {filteredUsers.length === 0 ? <p className="empty-state">No people match this search.</p> : (
                    <div className="admin-user-list">
                        {filteredUsers.map((item) => (
                            <article className="admin-user-row" key={item.id} data-testid="admin-user">
                                <div className="admin-user-avatar">{(item.name || item.email || "?").slice(0, 1).toUpperCase()}</div>
                                <div className="admin-user-info">
                                    <strong>{item.name || "Unnamed account"}</strong>
                                    <span>{item.email}</span>
                                    {item.bio && <p>{item.bio}</p>}
                                </div>
                                <span className={`status-pill status-${item.status || "active"}`}>{item.role} · {item.status || "active"}</span>
                                {item.role === "artist" && item.status !== "approved" && (
                                    <button
                                        className="button button-small"
                                        type="button"
                                        onClick={() => updateUserStatus(item, "approved")}
                                        disabled={Boolean(busy)}
                                    >{busy === `user-${item.id}` ? "Saving..." : "Approve artist"}</button>
                                )}
                                {item.role === "artist" && item.status === "approved" && (
                                    <button
                                        className="button button-small button-quiet"
                                        type="button"
                                        onClick={() => updateUserStatus(item, "pending")}
                                        disabled={Boolean(busy)}
                                    >Pause approval</button>
                                )}
                            </article>
                        ))}
                    </div>
                )}
            </section>

            <section className="admin-section">
                <div className="admin-section-heading">
                    <div><p className="eyebrow">Season planning</p><h2>Seasons and collections</h2></div>
                </div>
                <div className="admin-content-grid">
                    <form className="admin-form" data-form="create-season" onSubmit={(event) => submitContent(event, "/admin/seasons", (form) => ({
                        title: form.get("title"),
                        region: form.get("region"),
                        description: form.get("description"),
                        hero_image: form.get("hero_image"),
                    }), "Season created.")}>
                        <h3>Create a season</h3>
                        <label>Season title<input name="title" required placeholder="e.g. Spring in Oaxaca" /></label>
                        <label>Region<input name="region" required placeholder="Region or community" /></label>
                        <label>Description<textarea name="description" rows="3" required /></label>
                        <label>Hero image URL<input name="hero_image" type="url" placeholder="https://..." /></label>
                        <button className="button button-small" disabled={Boolean(busy)}>{busy === "create-season" ? "Saving..." : "Create season"}</button>
                    </form>

                    <form className="admin-form" data-form="create-series" onSubmit={(event) => submitContent(event, "/admin/series", (form) => ({
                        season_slug: form.get("season_slug"),
                        title: form.get("title"),
                        craft: form.get("craft"),
                        description: form.get("description"),
                        cover_image: form.get("cover_image"),
                    }), "Collection created.")}>
                        <h3>Create a collection</h3>
                        <label>Season<select name="season_slug" required defaultValue=""><option value="" disabled>Select a season</option>{data.seasons.map((season) => <option key={season.slug} value={season.slug}>{season.title}</option>)}</select></label>
                        <label>Collection title<input name="title" required /></label>
                        <label>Craft or medium<input name="craft" required placeholder="e.g. Woven textiles" /></label>
                        <label>Description<textarea name="description" rows="3" required /></label>
                        <label>Cover image URL<input name="cover_image" type="url" placeholder="https://..." /></label>
                        <button className="button button-small" disabled={Boolean(busy) || data.seasons.length === 0}>{busy === "create-series" ? "Saving..." : "Create collection"}</button>
                    </form>

                    <form className="admin-form" data-form="create-artwork" onSubmit={(event) => submitContent(event, "/admin/artworks", (form) => {
                        const selectedSeries = data.series.find((item) => item.slug === form.get("series_slug"));
                        return {
                            season_slug: selectedSeries?.season_slug,
                            series_slug: form.get("series_slug"),
                            title: form.get("title"),
                            artist_name: form.get("artist_name"),
                            kind: form.get("kind"),
                            description: form.get("description"),
                            image: form.get("image"),
                            price: Number(form.get("price")),
                        };
                    }, "Artwork added to the gallery.")}>
                        <h3>Add artwork</h3>
                        <label>Collection<select name="series_slug" required defaultValue=""><option value="" disabled>Select a collection</option>{data.series.map((item) => <option key={item.slug} value={item.slug}>{item.title}</option>)}</select></label>
                        <label>Artwork title<input name="title" required /></label>
                        <label>Artist name<input name="artist_name" required /></label>
                        <label>Type<input name="kind" required placeholder="e.g. Ceramic vessel" /></label>
                        <label>Description<textarea name="description" rows="3" required /></label>
                        <label>Image URL<input name="image" type="url" required placeholder="https://..." /></label>
                        <label>Price (USD)<input name="price" type="number" min="0" step="0.01" required /></label>
                        <button className="button button-small" disabled={Boolean(busy) || data.series.length === 0}>{busy === "create-artwork" ? "Saving..." : "Add artwork"}</button>
                    </form>

                    <form className="admin-form" data-form="create-box" onSubmit={(event) => submitContent(event, "/admin/boxes", (form) => ({
                        series_slug: form.get("series_slug"),
                        name: form.get("name"),
                        price: Number(form.get("price")),
                        image: form.get("image"),
                    }), "Blind box added to the collection.")}>
                        <h3>Create a blind box</h3>
                        <label>Collection<select name="series_slug" required defaultValue=""><option value="" disabled>Select a collection</option>{data.series.map((item) => <option key={item.slug} value={item.slug}>{item.title}</option>)}</select></label>
                        <label>Box name<input name="name" required placeholder="e.g. Kutch seasonal letter" /></label>
                        <label>Price (USD)<input name="price" type="number" min="0" step="0.01" required /></label>
                        <label>Image URL<input name="image" type="url" placeholder="https://..." /></label>
                        <button className="button button-small" disabled={Boolean(busy) || data.series.length === 0}>{busy === "create-box" ? "Saving..." : "Create blind box"}</button>
                    </form>

                    <form className="admin-form" data-form="create-poll" onSubmit={(event) => submitContent(event, "/admin/polls", (form) => ({
                        season_slug: form.get("season_slug"),
                        question: form.get("question"),
                        description: form.get("description"),
                        options: form.get("options").split("\n").map((option) => option.trim()).filter(Boolean),
                    }), "Poll created.")}>
                        <h3>Create a community poll</h3>
                        <label>Season<select name="season_slug" required defaultValue=""><option value="" disabled>Select a season</option>{data.seasons.map((season) => <option key={season.slug} value={season.slug}>{season.title}</option>)}</select></label>
                        <label>Question<input name="question" required /></label>
                        <label>Context<textarea name="description" rows="3" /></label>
                        <label>Options <span className="field-hint">(one per line)</span><textarea name="options" rows="4" required placeholder={"Option one\nOption two"} /></label>
                        <button className="button button-small" disabled={Boolean(busy) || data.seasons.length === 0}>{busy === "create-poll" ? "Saving..." : "Create poll"}</button>
                    </form>
                </div>

                <div className="admin-managed-lists">
                    <div>
                        <h3>Seasons</h3>
                        {data.seasons.map((season) => (
                            <article className="admin-managed-row" key={season.slug}>
                                <span><strong>{season.title}</strong><small>{season.region || season.slug}</small></span>
                                <span className={`status-pill status-${season.status || "live"}`}>{season.status || "live"}</span>
                                <button className="button button-small button-quiet" type="button" onClick={() => toggleSeason(season)} disabled={Boolean(busy)}>
                                    {season.status === "live" ? "Pause season" : "Make live"}
                                </button>
                            </article>
                        ))}
                    </div>
                    <div>
                        <h3>Polls</h3>
                        {data.polls.map((poll) => (
                            <article className="admin-managed-row" key={poll.id}>
                                <span><strong>{poll.question}</strong><small>{(poll.options || []).reduce((total, option) => total + Number(option.votes || 0), 0)} votes</small></span>
                                <span className={`status-pill ${poll.active ? "status-active" : "status-archived"}`}>{poll.active ? "active" : "paused"}</span>
                                <button className="button button-small button-quiet" type="button" onClick={() => togglePoll(poll)} disabled={Boolean(busy)}>
                                    {poll.active ? "Pause" : "Activate"}
                                </button>
                            </article>
                        ))}
                    </div>
                    <div>
                        <h3>Blind boxes</h3>
                        {data.boxes.map((box) => (
                            <article className="admin-managed-row" key={box.id}>
                                {box.image && <img src={mediaUrl(box.image)} alt="" />}
                                <span><strong>{box.name}</strong><small>{formatPrice(box.price)}</small></span>
                                <span className={`status-pill ${box.active ? "status-active" : "status-archived"}`}>{box.active ? "active" : "paused"}</span>
                                <button className="button button-small button-quiet" type="button" onClick={() => toggleBox(box)} disabled={Boolean(busy)}>
                                    {box.active ? "Pause" : "Activate"}
                                </button>
                            </article>
                        ))}
                    </div>
                    <div>
                        <h3>Recent artwork</h3>
                        {data.artworks.slice(0, 8).map((artwork) => (
                            <article className="admin-managed-row" key={artwork.id}>
                                {artwork.image && <img src={mediaUrl(artwork.image)} alt="" />}
                                <span><strong>{artwork.title}</strong><small>{artwork.artist_name} · {formatPrice(artwork.price)}</small></span>
                            </article>
                        ))}
                    </div>
                </div>
            </section>

            <section className="admin-section">
                <div className="admin-section-heading">
                    <div><p className="eyebrow">Artist submissions</p><h2>Review the work</h2></div>
                </div>
                {data.submissions.length === 0 ? <p className="empty-state">No submissions yet.</p> : (
                    <div className="admin-submission-list">
                        {data.submissions.map((item) => (
                            <article className="admin-submission" key={item.id} data-testid="admin-submission">
                                {item.image && <img src={mediaUrl(item.image)} alt={item.title || "Artist submission"} />}
                                <div>
                                    <h3>{item.title || "Untitled work"}</h3>
                                    <p>{item.description}</p>
                                    <small>{item.artist_name || item.artist_email} · {item.status}</small>
                                </div>
                                {item.status === "pending" && <div className="admin-submission-actions">
                                    <button className="button button-small" type="button" onClick={() => decideSubmission(item, "approved")} disabled={Boolean(busy)}>Approve</button>
                                    <button className="button button-small button-quiet" type="button" onClick={() => decideSubmission(item, "rejected")} disabled={Boolean(busy)}>Decline</button>
                                </div>}
                            </article>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}

export default Admin;
