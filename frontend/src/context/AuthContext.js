import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const refreshUser = useCallback(async () => {
        try {
            const currentUser = await api("/auth/me");
            setUser(currentUser);
            return currentUser;
        } catch (error) {
            if (!/not authenticated|token expired|invalid token|refresh token/i.test(error.message)) {
                throw error;
            }
            try {
                await api("/auth/refresh", { method: "POST" });
                const currentUser = await api("/auth/me");
                setUser(currentUser);
                return currentUser;
            } catch (refreshError) {
                if (!/not authenticated|token expired|invalid token|refresh token|user not found/i.test(refreshError.message)) {
                    throw refreshError;
                }
                setUser(false);
                return false;
            }
        }
    }, []);

    useEffect(() => {
        let active = true;
        refreshUser()
            .catch((error) => {
                console.error("Could not restore the signed-in session.", error);
                if (active) setUser(false);
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => {
            active = false;
        };
    }, [refreshUser]);

    const login = useCallback(async (credentials) => {
        const signedInUser = await api("/auth/login", {
            method: "POST",
            body: JSON.stringify(credentials),
        });
        setUser(signedInUser);
        return signedInUser;
    }, []);

    const register = useCallback(async (details) => {
        const newUser = await api("/auth/register", {
            method: "POST",
            body: JSON.stringify(details),
        });
        setUser(newUser);
        return newUser;
    }, []);

    const logout = useCallback(async () => {
        await api("/auth/logout", { method: "POST" });
        setUser(false);
    }, []);

    const value = useMemo(
        () => ({ user, loading, login, register, logout, refreshUser }),
        [user, loading, login, register, logout, refreshUser],
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) throw new Error("useAuth must be used within AuthProvider");
    return context;
}
