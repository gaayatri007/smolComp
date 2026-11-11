import { Link, NavLink, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";

const portalPath = (role) => {
    if (role === "admin") return "/admin";
    if (role === "artist") return "/studio";
    return "/account";
};

export default function Nav() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [menuOpen, setMenuOpen] = useState(false);
    const [signOutError, setSignOutError] = useState("");

    const handleLogout = async () => {
        setSignOutError("");
        try {
            await logout();
            navigate("/");
            setMenuOpen(false);
        } catch (error) {
            setSignOutError(error.message);
        }
    };

    const links = [
        { to: "/exhibition/kutch-resonance", label: "Exhibition" },
        { to: "/vault", label: "Secret vault" },
        { to: "/timeless", label: "Timeless" },
        { to: "/polls", label: "Region poll" },
    ];

    return (
        <header className="site-header">
            <div className="site-header-inner">
                <Link to="/" className="brand-lockup" onClick={() => setMenuOpen(false)}>
                    <span className="brand-mark">s</span>
                    <span>smolComp</span>
                </Link>
                <button
                    className="menu-toggle"
                    type="button"
                    aria-expanded={menuOpen}
                    aria-label={menuOpen ? "Close navigation" : "Open navigation"}
                    data-testid="nav-menu-toggle"
                    onClick={() => setMenuOpen((open) => !open)}
                >
                    {menuOpen ? "Close" : "Menu"}
                </button>
                <nav className={`main-nav${menuOpen ? " is-open" : ""}`} aria-label="Main navigation">
                    {links.map((link) => (
                        <NavLink
                            key={link.to}
                            to={link.to}
                            className={({ isActive }) => `nav-link${isActive ? " is-active" : ""}`}
                            onClick={() => setMenuOpen(false)}
                            data-testid={`nav-${link.label.toLowerCase().replaceAll(" ", "-")}`}
                        >
                            {link.label}
                        </NavLink>
                    ))}
                    <span className="season-chip">SEASON I · KUTCH</span>
                    {user && user !== false ? (
                        <div className="nav-account">
                            <Link to={portalPath(user.role)} className="nav-link" onClick={() => setMenuOpen(false)}>
                                {user.name || "Your space"}
                            </Link>
                            <button type="button" className="text-button" onClick={handleLogout} data-testid="nav-logout">
                                Sign out
                            </button>
                        </div>
                    ) : (
                        <Link to="/login/customer" className="nav-visit" onClick={() => setMenuOpen(false)} data-testid="nav-sign-in">
                            Enter the gallery
                        </Link>
                    )}
                    {signOutError && <p className="nav-error" role="alert">{signOutError}</p>}
                </nav>
            </div>
        </header>
    );
}
