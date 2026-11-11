import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

const portalNames = {
    customer: "Collector",
    artist: "Maker",
    admin: "Curator",
};

const homeForRole = (role) => {
    if (role === "admin") return "/admin";
    if (role === "artist") return "/studio";
    return "/account";
};

export default function AuthPage({ mode = "login" }) {
    const { role = "customer" } = useParams();
    const isRegister = mode === "register";
    const { login, register } = useAuth();
    const navigate = useNavigate();
    const [form, setForm] = useState({ name: "", email: "", password: "", craft: "", region: "" });
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);

    const update = (event) => {
        setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
    };

    const submit = async (event) => {
        event.preventDefault();
        setError("");
        setBusy(true);
        try {
            if (isRegister) {
                const newUser = await register({ ...form, role });
                navigate(homeForRole(newUser.role), { replace: true });
            } else {
                const signedInUser = await login({ email: form.email, password: form.password, role });
                navigate(homeForRole(signedInUser.role), { replace: true });
            }
        } catch (requestError) {
            setError(requestError.message);
        } finally {
            setBusy(false);
        }
    };

    const title = role === "artist"
        ? (isRegister ? "Begin your studio application." : "Welcome back to your studio.")
        : role === "admin"
            ? "Curator access."
            : (isRegister ? "Collect stories, not things." : "The gallery remembers you.");

    return (
        <main className="auth-page">
            <section className="auth-aside">
                <p className="eyebrow">smolComp · {portalNames[role] || "Collector"} portal</p>
                <h1 className="display-title">{title}</h1>
                <p>
                    {role === "artist"
                        ? "Share the practice behind your work. New studio applications are reviewed by our curators."
                        : role === "admin"
                            ? "A quiet entrance for the people who care for the collection."
                            : "Keep the pieces you find, the makers you meet, and the seasons you carry with you."}
                </p>
                <Link to="/" className="quiet-link">← Back to the gallery</Link>
            </section>
            <form className="auth-form" onSubmit={submit} data-testid="auth-form">
                <p className="eyebrow">{isRegister ? "Create your account" : "Sign in"}</p>
                <h2>{isRegister ? "A place in the archive" : "Enter your details"}</h2>
                {error && <div className="notice notice-error" role="alert" data-testid="auth-error">{error}</div>}
                {isRegister && (
                    <label className="field">
                        <span>Name</span>
                        <input name="name" value={form.name} onChange={update} required maxLength={120} autoComplete="name" data-testid="auth-name" />
                    </label>
                )}
                <label className="field">
                    <span>Email</span>
                    <input type="email" name="email" value={form.email} onChange={update} required autoComplete="email" data-testid="auth-email" />
                </label>
                <label className="field">
                    <span>Password</span>
                    <input type="password" name="password" value={form.password} onChange={update} required minLength={6} maxLength={128} autoComplete={isRegister ? "new-password" : "current-password"} data-testid="auth-password" />
                </label>
                {isRegister && role === "artist" && (
                    <>
                        <label className="field">
                            <span>Craft or practice</span>
                            <input name="craft" value={form.craft} onChange={update} maxLength={120} data-testid="auth-craft" />
                        </label>
                        <label className="field">
                            <span>Region</span>
                            <input name="region" value={form.region} onChange={update} maxLength={120} data-testid="auth-region" />
                        </label>
                    </>
                )}
                <button className="button auth-submit" type="submit" disabled={busy} data-testid="auth-submit">
                    {busy ? "One moment..." : isRegister ? "Create account" : "Enter"}
                </button>
                {role !== "admin" && (
                    <p className="auth-switch">
                        {isRegister ? "Already have a place here?" : "New to smolComp?"}{" "}
                        <Link to={`/${isRegister ? "login" : "register"}/${role}`}>
                            {isRegister ? "Sign in" : "Create an account"}
                        </Link>
                    </p>
                )}
                {role === "customer" && (
                    <p className="portal-switch">
                        Making work? <Link to={`/${isRegister ? "register" : "login"}/artist`}>Artist portal</Link>
                    </p>
                )}
                {role !== "admin" && (
                    <p className="portal-switch">
                        Curating the collection? <Link to="/login/admin">Curator sign-in</Link>
                    </p>
                )}
            </form>
        </main>
    );
}
