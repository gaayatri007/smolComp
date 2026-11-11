import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PageLoader from "@/components/PageLoader";
import SectionHeading from "@/components/SectionHeading";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function Polls() {
    const [polls, setPolls] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [busyPoll, setBusyPoll] = useState("");
    const { user } = useAuth();

    const loadPolls = async () => {
        const result = await api("/polls");
        setPolls(result);
    };

    useEffect(() => {
        let active = true;
        api("/polls")
            .then((result) => { if (active) setPolls(result); })
            .catch((requestError) => { if (active) setError(requestError.message); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, []);

    const vote = async (poll, optionId) => {
        if (!user || user === false) return;
        setBusyPoll(poll.id);
        setError("");
        try {
            await api(`/polls/${encodeURIComponent(poll.id)}/vote`, {
                method: "POST",
                body: JSON.stringify({ option_id: optionId }),
            });
            await loadPolls();
        } catch (requestError) {
            setError(requestError.message);
        } finally {
            setBusyPoll("");
        }
    };

    if (loading) return <PageLoader />;

    return (
        <main className="page-wrap">
            <SectionHeading
                eyebrow="The next letter"
                title="Where should we go next?"
                description="Help us choose which craft tradition we spend time with in the next season."
            />
            {error && <div className="notice notice-error" role="alert" data-testid="poll-error">{error}</div>}
            {!user || user === false ? (
                <p className="inline-note">Sign in to cast a vote. <Link to="/login/customer">Enter the gallery ↗</Link></p>
            ) : null}
            {polls.length ? (
                <div className="poll-list">
                    {polls.map((poll) => {
                        const totalVotes = (poll.options || []).reduce((sum, option) => sum + (option.votes || 0), 0);
                        return (
                            <article className="poll-card" key={poll.id} data-testid={`poll-${poll.id}`}>
                                <p className="eyebrow">A question for the community</p>
                                <h2>{poll.question}</h2>
                                {poll.description && <p className="poll-description">{poll.description}</p>}
                                <div className="poll-options">
                                    {(poll.options || []).map((option) => {
                                        const percent = totalVotes ? Math.round((option.votes / totalVotes) * 100) : 0;
                                        const voted = poll.my_vote === option.id;
                                        return (
                                            <button
                                                key={option.id}
                                                type="button"
                                                className={`poll-option${voted ? " is-voted" : ""}`}
                                                disabled={!user || user === false || Boolean(poll.my_vote) || busyPoll === poll.id}
                                                onClick={() => vote(poll, option.id)}
                                                data-testid={`vote-${poll.id}-${option.id}`}
                                            >
                                                <span className="poll-option-label"><span>{option.label}</span><strong>{percent}%</strong></span>
                                                <span className="poll-meter"><span style={{ width: `${percent}%` }} /></span>
                                            </button>
                                        );
                                    })}
                                </div>
                                <p className="poll-footnote">{totalVotes} {totalVotes === 1 ? "voice" : "voices"}{poll.my_vote ? " · your vote is in" : ""}</p>
                            </article>
                        );
                    })}
                </div>
            ) : (
                <div className="empty-panel" data-testid="polls-empty">
                    <p className="eyebrow">The question is being prepared</p>
                    <p>There are no active region polls just now.</p>
                </div>
            )}
        </main>
    );
}
