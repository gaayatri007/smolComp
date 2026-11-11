import { Link, NavLink, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { ShoppingBag } from "lucide-react";

const portalPath = (role) => {
    if (role === "admin") return "/admin";
    if (role === "artist") return "/studio";
    return "/account";
};

export default function Nav() {
    const { user, logout } = useAuth();
    const { items } = useCart();
    const cartCount = items.reduce((count, item) => count + (item.quantity || 1), 0);
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
        { to: "/artists", label: "Artists" },
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
                <NavLink
                    to="/cart"
                    className={({ isActive }) => `nav-cart mobile-nav-cart${isActive ? " is-active" : ""}`}
                    onClick={() => setMenuOpen(false)}
                    aria-label={`Shopping basket, ${cartCount} items`}
                    data-testid="nav-cart-mobile"
                >
                    <ShoppingBag size={17} aria-hidden="true" />
                    <span>Basket</span>
                    <span className="cart-count">{cartCount}</span>
                </NavLink>
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
                    <NavLink
                        to="/cart"
                        className={({ isActive }) => `nav-cart${isActive ? " is-active" : ""}`}
                        onClick={() => setMenuOpen(false)}
                        aria-label={`Shopping basket, ${cartCount} items`}
                        data-testid="nav-cart"
                    >
                        <ShoppingBag size={17} aria-hidden="true" />
                        <span>Basket</span>
                        <span className="cart-count" data-testid="cart-count">
                            {cartCount}
                        </span>
                    </NavLink>
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
