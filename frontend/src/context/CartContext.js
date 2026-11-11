import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "smolcomp-cart";
const CartContext = createContext(null);

function readCart() {
    try {
        const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
        return Array.isArray(saved) ? saved.filter((item) => item?.id && item?.name) : [];
    } catch (error) {
        console.error("Could not read the saved basket.", error);
        return [];
    }
}

export function CartProvider({ children }) {
    const [items, setItems] = useState(readCart);

    useEffect(() => {
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
        } catch (error) {
            console.error("Could not save the basket in this browser.", error);
        }
    }, [items]);

    useEffect(() => {
        const syncCart = (event) => {
            if (event.key === STORAGE_KEY) setItems(readCart());
        };
        window.addEventListener("storage", syncCart);
        return () => window.removeEventListener("storage", syncCart);
    }, []);

    const addItem = useCallback((item) => {
        setItems((current) => {
            const existing = current.find((entry) => entry.id === item.id && entry.type === item.type);
            if (existing && item.type === "box") {
                return current.map((entry) => (
                    entry.id === item.id && entry.type === item.type
                        ? { ...entry, quantity: Math.min(10, (entry.quantity || 1) + 1) }
                        : entry
                ));
            }
            if (existing) return current;
            return [...current, { ...item, quantity: 1 }];
        });
    }, []);

    const removeItem = useCallback((id, type) => {
        setItems((current) => current.filter((item) => item.id !== id || item.type !== type));
    }, []);

    const setQuantity = useCallback((id, type, quantity) => {
        const nextQuantity = Math.max(1, Math.min(10, Number(quantity) || 1));
        setItems((current) => current.map((item) => (
            item.id === id && item.type === type && type === "box"
                ? { ...item, quantity: nextQuantity }
                : item
        )));
    }, []);

    const clearCart = useCallback(() => setItems([]), []);
    const value = useMemo(
        () => ({ items, addItem, removeItem, setQuantity, clearCart }),
        [items, addItem, removeItem, setQuantity, clearCart],
    );

    return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
    const context = useContext(CartContext);
    if (!context) throw new Error("useCart must be used within CartProvider");
    return context;
}
