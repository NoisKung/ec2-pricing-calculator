'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { EC2DataMap, FilteredInstance, CartItem, PricingModelKey } from '@/types/ec2';
import { API_URL, PRICING_MODELS, REGION_NAMES, PRIORITY_REGIONS } from '@/constants/ec2';
import { isValidRegionCode } from '@/lib/utils';

const CART_STORAGE_KEY = 'ec2cal-cart';

function loadCartFromStorage(): CartItem[] {
    if (typeof window === 'undefined') return [];
    try {
        const raw = localStorage.getItem(CART_STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
}

function saveCartToStorage(cart: CartItem[]) {
    if (typeof window === 'undefined') return;
    try { localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart)); }
    catch { /* quota exceeded, ignore */ }
}

export function useEC2Data() {
    const [ec2Data, setEc2Data] = useState<EC2DataMap>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [instanceCount, setInstanceCount] = useState(0);

    // Filters
    const [region, setRegion] = useState('ap-southeast-1');
    const [os, setOs] = useState('Linux');
    const [family, setFamily] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');

    // Selection
    const [selectedInstance, setSelectedInstance] = useState<FilteredInstance | null>(null);
    const [selectedModel, setSelectedModel] = useState<PricingModelKey>('ondemand');
    const [quantity, setQuantity] = useState(1);
    const [hours, setHours] = useState(730);

    // Cart — initialize from localStorage
    const [cart, setCart] = useState<CartItem[]>([]);
    const [cartLoaded, setCartLoaded] = useState(false);

    // Load cart from localStorage on mount
    useEffect(() => {
        setCart(loadCartFromStorage());
        setCartLoaded(true);
    }, []);

    // Persist cart to localStorage on every change (after initial load)
    useEffect(() => {
        if (cartLoaded) saveCartToStorage(cart);
    }, [cart, cartLoaded]);

    // Fetch data
    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const resp = await fetch(API_URL);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data: EC2DataMap = await resp.json();
            setEc2Data(data);
            setInstanceCount(Object.keys(data).length);
            setLoading(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    // Available regions
    const regions = useMemo(() => {
        const regionSet = new Set<string>();
        Object.values(ec2Data).forEach(inst => {
            if (inst.regions) inst.regions.forEach(r => regionSet.add(r));
        });

        return [...regionSet]
            .filter(r => isValidRegionCode(r))
            .sort((a, b) => {
                const pa = PRIORITY_REGIONS.indexOf(a);
                const pb = PRIORITY_REGIONS.indexOf(b);
                if (pa !== -1 && pb !== -1) return pa - pb;
                if (pa !== -1) return -1;
                if (pb !== -1) return 1;
                return (REGION_NAMES[a] || a).localeCompare(REGION_NAMES[b] || b);
            });
    }, [ec2Data]);

    // Filtered instances & families
    const { filteredInstances, families } = useMemo(() => {
        const familySet = new Set<string>();
        const instances: FilteredInstance[] = [];

        Object.entries(ec2Data).forEach(([name, data]) => {
            if (!data.prices || !data.prices[os]) return;
            const osRegions = data.prices[os];
            if (!osRegions[region]) return;

            const regionPrices = osRegions[region];
            const price = regionPrices.Shared || regionPrices.Dedicated || Object.values(regionPrices)[0];
            if (!price || price <= 0) return;

            const fam = name.split('.')[0];
            familySet.add(fam);

            if (family === 'all' || fam === family) {
                instances.push({
                    name,
                    family: fam,
                    vcpu: data.vcpu || '-',
                    memory: data.memory || '-',
                    storage: data.storage || 'EBS only',
                    network: data.networkPerformance || '-',
                    price,
                    currentGen: data.currentGeneration !== false,
                });
            }
        });

        instances.sort((a, b) => {
            if (a.currentGen !== b.currentGen) return (b.currentGen ? 1 : 0) - (a.currentGen ? 1 : 0);
            if (a.family !== b.family) return a.family.localeCompare(b.family);
            return (parseInt(String(a.vcpu)) || 0) - (parseInt(String(b.vcpu)) || 0);
        });

        return { filteredInstances: instances, families: [...familySet].sort() };
    }, [ec2Data, region, os, family]);

    // Search results
    const searchResults = useMemo(() => {
        const q = searchQuery.toLowerCase().trim();
        return filteredInstances
            .filter(inst => inst.name.toLowerCase().includes(q) || inst.family.toLowerCase().includes(q))
            .slice(0, 100);
    }, [filteredInstances, searchQuery]);

    // Live preview
    const livePreview = useMemo(() => {
        if (!selectedInstance) return { monthly: 0, hourly: 0 };
        const hourly = selectedInstance.price * PRICING_MODELS[selectedModel].discount;
        return { monthly: hourly * hours, hourly };
    }, [selectedInstance, selectedModel, hours]);

    // Pricing comparison
    const pricingComparison = useMemo(() => {
        if (!selectedInstance) return [];
        return (Object.entries(PRICING_MODELS) as [PricingModelKey, typeof PRICING_MODELS[PricingModelKey]][]).map(([key, model]) => {
            const hourly = selectedInstance.price * model.discount;
            return {
                key,
                label: model.label,
                hourly,
                monthly: hourly * hours,
                savings: ((1 - model.discount) * 100).toFixed(0),
            };
        });
    }, [selectedInstance, hours]);

    // Cart total
    const grandTotal = useMemo(() => cart.reduce((sum, item) => sum + item.total, 0), [cart]);

    // Actions
    const selectInstance = useCallback((name: string) => {
        const inst = filteredInstances.find(i => i.name === name);
        if (inst) {
            setSelectedInstance(inst);
            setSearchQuery(inst.name);
        }
    }, [filteredInstances]);

    const addToCart = useCallback(() => {
        if (!selectedInstance) return;
        if (quantity <= 0 || hours <= 0) return;

        const model = PRICING_MODELS[selectedModel];
        const hourlyRate = selectedInstance.price * model.discount;
        const totalMonthly = hourlyRate * hours * quantity;

        // Check for duplicate: same type + region + os + model
        setCart(prev => {
            const existingIdx = prev.findIndex(
                item => item.type === selectedInstance.name &&
                    item.regionId === region &&
                    item.os === os &&
                    item.model === selectedModel &&
                    item.hours === hours
            );

            if (existingIdx >= 0) {
                // Merge: add quantity to existing item
                const updated = [...prev];
                const existing = updated[existingIdx];
                const newQty = existing.qty + quantity;
                updated[existingIdx] = {
                    ...existing,
                    qty: newQty,
                    total: existing.hourlyRate * existing.hours * newQty,
                };
                return updated;
            }

            return [...prev, {
                id: Date.now().toString(),
                region: REGION_NAMES[region] || region,
                regionId: region,
                os,
                type: selectedInstance.name,
                specs: `${selectedInstance.vcpu} vCPUs, ${selectedInstance.memory}`,
                model: selectedModel,
                modelLabel: model.label,
                qty: quantity,
                hours,
                hourlyRate,
                total: totalMonthly,
            }];
        });

        setQuantity(1);
    }, [selectedInstance, selectedModel, region, os, quantity, hours]);

    const updateCartItemQty = useCallback((id: string, newQty: number) => {
        if (newQty <= 0) return;
        setCart(prev => prev.map(item =>
            item.id === id
                ? { ...item, qty: newQty, total: item.hourlyRate * item.hours * newQty }
                : item
        ));
    }, []);

    const duplicateCartItem = useCallback((id: string) => {
        setCart(prev => {
            const item = prev.find(i => i.id === id);
            if (!item) return prev;
            return [...prev, { ...item, id: Date.now().toString() }];
        });
    }, []);

    const removeFromCart = useCallback((id: string) => {
        setCart(prev => prev.filter(item => item.id !== id));
    }, []);

    const clearCart = useCallback(() => {
        setCart([]);
    }, []);

    const exportCartCSV = useCallback(() => {
        if (cart.length === 0) return;
        const headers = ['Instance Type', 'OS', 'Region', 'Specs', 'Pricing Model', 'Quantity', 'Hours/Month', 'Hourly Rate (USD)', 'Monthly Cost (USD)'];
        const rows = cart.map(item => [
            item.type, item.os, item.region, item.specs,
            item.modelLabel, item.qty, item.hours,
            item.hourlyRate.toFixed(4), item.total.toFixed(2)
        ]);
        rows.push(['', '', '', '', '', '', '', 'Grand Total', grandTotal.toFixed(2)]);

        const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ec2-estimate-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }, [cart, grandTotal]);

    // Reset selection on filter change
    useEffect(() => {
        setSelectedInstance(null);
        setSearchQuery('');
    }, [region, os, family]);

    return {
        // State
        loading, error, instanceCount,
        region, os, family, searchQuery,
        selectedInstance, selectedModel,
        quantity, hours,
        cart,

        // Computed
        regions, families, filteredInstances, searchResults,
        livePreview, pricingComparison, grandTotal,

        // Actions
        fetchData, setRegion, setOs, setFamily, setSearchQuery,
        selectInstance, setSelectedModel,
        setQuantity, setHours,
        addToCart, updateCartItemQty, duplicateCartItem,
        removeFromCart, clearCart, exportCartCSV,
    };
}
