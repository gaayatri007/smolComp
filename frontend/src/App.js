import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation, Link } from "react-router-dom";
import Lenis from "lenis";
import "./App.css";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Home from "@/pages/Home";
import Exhibition from "@/pages/Exhibition";
import Vault from "@/pages/Vault";
import Timeless from "@/pages/Timeless";
import Polls from "@/pages/Polls";
import AuthPage from "@/pages/Auth";
import Account from "@/pages/Account";
import Studio from "@/pages/Studio";
import Admin from "@/pages/Admin";
import PaymentResult from "@/pages/PaymentResult";
import Artists from "@/pages/Artists";
import Cart from "@/pages/Cart";
import PageLoader from "@/components/PageLoader";
import { CartProvider } from "@/context/CartContext";

export { default as PageLoader } from "@/components/PageLoader";

class ErrorBoundary extends React.Component {
    state = { err: false };
    static getDerivedStateFromError() {
        return { err: true };
    }
    render() {
        if (this.state.err) {
            return (
                <div className="min-h-screen bg-obsidian text-bone flex flex-col items-center justify-center gap-5 font-display">
                    <p className="text-3xl">The lights flickered.</p>
                    <button
                        data-testid="error-reload-button"
                        onClick={() => window.location.reload()}
                        className="font-mono text-xs tracking-[0.2em] uppercase border border-brass/40 px-6 py-3 hover:bg-brass/10 transition-colors"
                    >
                        Relight the gallery
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

function ScrollManager() {
    const { pathname, hash } = useLocation();
    useEffect(() => {
        if (hash) {
            const t = setTimeout(() => {
                document.querySelector(hash)?.scrollIntoView({ behavior: "smooth" });
            }, 400);
            return () => clearTimeout(t);
        }
        window.scrollTo(0, 0);
        if (window.__lenis) window.__lenis.scrollTo(0, { immediate: true });
    }, [pathname, hash]);
    return null;
}

function LenisRoot() {
    useEffect(() => {
        const lenis = new Lenis({ duration: 1.1, smoothWheel: true });
        window.__lenis = lenis;
        let raf;
        const loop = (t) => {
            lenis.raf(t);
            raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
        return () => {
            cancelAnimationFrame(raf);
            lenis.destroy();
            window.__lenis = null;
        };
    }, []);
    return null;
}

const portalFor = (role) =>
    role === "admin" ? "/login/admin" : role === "artist" ? "/login/artist" : "/login/customer";

function Guard({ role, children }) {
    const { user } = useAuth();
    if (user === null) return <PageLoader />;
    if (!user) return <Navigate to={portalFor(role)} replace />;
    if (user.role !== role) {
        return (
            <div className="min-h-screen bg-obsidian flex flex-col items-center justify-center gap-4 px-6 text-center" data-testid="wrong-portal">
                <p className="font-display text-2xl text-bone">Wrong wing of the museum.</p>
                <p className="text-sm text-ink2 max-w-sm">
                    You are signed in as <span className="text-brass">{user.role}</span> — this door is for the{" "}
                    <span className="text-brass">{role}</span> portal.
                </p>
                <div className="flex gap-3 mt-2">
                    <Link
                        data-testid="wrong-portal-go-mine"
                        to={portalFor(user.role) === "/login/customer" ? "/account" : portalFor(user.role)}
                        className="font-mono text-xs tracking-[0.2em] uppercase border border-brass/40 px-5 py-2.5 hover:bg-brass/10 transition-colors"
                    >
                        My portal
                    </Link>
                </div>
            </div>
        );
    }
    return children;
}

function NotFound() {
    return (
        <div className="min-h-screen bg-obsidian flex flex-col items-center justify-center gap-5 px-6 text-center">
            <p className="font-mono text-xs tracking-[0.25em] uppercase text-brass/70">404</p>
            <p className="font-display text-4xl text-bone">This hall does not exist.</p>
            <Link
                data-testid="notfound-home-link"
                to="/"
                className="font-mono text-xs tracking-[0.2em] uppercase border border-bone/20 px-6 py-3 hover:border-brass/60 hover:bg-brass/10 transition-colors"
            >
                Back to the gallery
            </Link>
        </div>
    );
}

function App() {
    return (
        <ErrorBoundary>
            <AuthProvider>
                <CartProvider>
                    <LenisRoot />
                    <BrowserRouter>
                        <ScrollManager />
                        <div className="grain min-h-screen bg-obsidian text-bone">
                            <Nav />
                            <Routes>
                                <Route path="/" element={<Home />} />
                                <Route path="/exhibition/:slug" element={<Exhibition />} />
                                <Route path="/vault" element={<Vault />} />
                                <Route path="/timeless" element={<Timeless />} />
                                <Route path="/polls" element={<Polls />} />
                                <Route path="/artists" element={<Artists />} />
                                <Route path="/cart" element={<Cart />} />
                                <Route path="/login/:role" element={<AuthPage mode="login" />} />
                                <Route path="/register/:role" element={<AuthPage mode="register" />} />
                                <Route
                                    path="/account"
                                    element={
                                        <Guard role="customer">
                                            <Account />
                                        </Guard>
                                    }
                                />
                                <Route
                                    path="/studio"
                                    element={
                                        <Guard role="artist">
                                            <Studio />
                                        </Guard>
                                    }
                                />
                                <Route
                                    path="/admin"
                                    element={
                                        <Guard role="admin">
                                            <Admin />
                                        </Guard>
                                    }
                                />
                                <Route path="/payment/success" element={<PaymentResult success />} />
                                <Route path="/payment/cancel" element={<PaymentResult />} />
                                <Route path="*" element={<NotFound />} />
                            </Routes>
                            <Footer />
                            <Toaster position="bottom-right" />
                        </div>
                    </BrowserRouter>
                </CartProvider>
            </AuthProvider>
        </ErrorBoundary>
    );
}

export default App;
