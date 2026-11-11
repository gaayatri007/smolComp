import { useEffect, useState } from "react";
import PageLoader from "@/components/PageLoader";
import SectionHeading from "@/components/SectionHeading";
import { api, mediaUrl } from "@/lib/api";

function initials(name) {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

export default function Artists() {
    const [artists, setArtists] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        let active = true;
        api("/artists")
            .then((result) => { if (active) setArtists(result); })
            .catch((requestError) => { if (active) setError(requestError.message); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, []);

    if (loading) return <PageLoader />;

    return (
        <main className="page-wrap">
            <SectionHeading
                eyebrow="The people behind the practice"
                title="Meet the makers."
                description="Every season begins with a conversation: how a craft is learned, who keeps it alive, and what the next generation might make of it."
            />
            {error && <div className="notice notice-error" role="alert">{error}</div>}
            {artists.some((artist) => artist.is_demo) && (
                <p className="demo-disclosure">Some profiles are clearly marked studio previews. They are fictional examples for exploring the gallery.</p>
            )}
            {artists.length ? (
                <section className="artist-grid" aria-label="Approved artists">
                    {artists.map((artist) => (
                        <article className="artist-card" key={artist.id} data-testid={`artist-${artist.id}`}>
                            <div className="artist-portrait">
                                {artist.profile_image
                                    ? <img src={mediaUrl(artist.profile_image)} alt={`${artist.name}, ${artist.craft}`} loading="lazy" />
                                    : <span aria-hidden="true">{initials(artist.name)}</span>}
                                {artist.is_demo && <span className="demo-tag">Studio preview</span>}
                            </div>
                            <div className="artist-card-copy">
                                <p className="eyebrow">{artist.region || "India"} · {artist.craft || "Independent practice"}</p>
                                <h2>{artist.name}</h2>
                                <p>{artist.bio || "A maker sharing the practice and stories behind their work."}</p>
                            </div>
                        </article>
                    ))}
                </section>
            ) : !error ? (
                <div className="empty-panel">
                    <p className="eyebrow">The makers' room is being prepared</p>
                    <p>Approved artists and their stories will appear here as each season is curated.</p>
                </div>
            ) : null}
        </main>
    );
}
