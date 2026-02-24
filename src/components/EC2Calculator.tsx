'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useEC2Data } from '@/hooks/useEC2Data';
import { PRICING_MODELS, REGION_NAMES, MODEL_BADGE_COLORS, MODEL_SHORT_LABELS } from '@/constants/ec2';
import { formatCurrency } from '@/lib/utils';
import { PricingModelKey } from '@/types/ec2';

const HOUR_PRESETS = [
    { label: '24/7', value: 730, desc: 'เต็มเดือน' },
    { label: '12h', value: 365, desc: '12 ชม./วัน' },
    { label: '8h', value: 176, desc: 'วันทำงาน' },
    { label: '4h', value: 88, desc: '4 ชม./วัน' },
];

export default function EC2Calculator() {
    const ec2 = useEC2Data();
    const [showDropdown, setShowDropdown] = useState(false);
    const [addFlash, setAddFlash] = useState(false);
    const [highlightIndex, setHighlightIndex] = useState(-1);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);

    // Close dropdown on outside click
    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (
                dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
                searchRef.current && !searchRef.current.contains(e.target as Node)
            ) {
                setShowDropdown(false);
                setHighlightIndex(-1);
            }
        }
        document.addEventListener('click', handleClick);
        return () => document.removeEventListener('click', handleClick);
    }, []);

    // Reset highlight when search changes
    useEffect(() => { setHighlightIndex(-1); }, [ec2.searchQuery]);

    // Keyboard navigation for dropdown
    const handleSearchKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (!showDropdown) return;
        const results = ec2.searchResults;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightIndex(prev => (prev + 1) % results.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightIndex(prev => (prev - 1 + results.length) % results.length);
        } else if (e.key === 'Enter' && highlightIndex >= 0 && highlightIndex < results.length) {
            e.preventDefault();
            ec2.selectInstance(results[highlightIndex].name);
            setShowDropdown(false);
            setHighlightIndex(-1);
        } else if (e.key === 'Escape') {
            setShowDropdown(false);
            setHighlightIndex(-1);
        }
    }, [showDropdown, ec2, highlightIndex]);

    // Scroll highlighted item into view
    useEffect(() => {
        if (highlightIndex < 0 || !dropdownRef.current) return;
        const items = dropdownRef.current.querySelectorAll('[data-instance-option]');
        items[highlightIndex]?.scrollIntoView({ block: 'nearest' });
    }, [highlightIndex]);

    function handleAddToCart() {
        if (!ec2.selectedInstance || ec2.quantity <= 0 || ec2.hours <= 0) {
            alert('กรุณากรอกจำนวนและชั่วโมงให้ถูกต้อง (มากกว่า 0)');
            return;
        }
        ec2.addToCart();
        setAddFlash(true);
        setTimeout(() => setAddFlash(false), 1000);
    }

    // Loading state
    if (ec2.loading) {
        return (
            <div className="space-y-6 animate-pulse">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-4 space-y-4">
                        <div className="skeleton h-12 w-full rounded-xl" />
                        <div className="skeleton h-48 w-full rounded-xl" />
                        <div className="skeleton h-32 w-full rounded-xl" />
                    </div>
                    <div className="lg:col-span-8 space-y-4">
                        <div className="skeleton h-12 w-full rounded-xl" />
                        <div className="skeleton h-64 w-full rounded-xl" />
                    </div>
                </div>
                <p className="text-center text-gray-500 text-sm mt-8 flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5 text-blue-500" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                    กำลังดึงข้อมูลราคา EC2 จาก AWS...
                </p>
            </div>
        );
    }

    // Error state
    if (ec2.error) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center max-w-lg mx-auto mt-12">
                <div className="text-5xl mb-4">⚠️</div>
                <h3 className="text-lg font-semibold text-red-800 mb-2">ไม่สามารถโหลดข้อมูลราคาได้</h3>
                <p className="text-sm text-red-600 mb-4">{ec2.error}</p>
                <button
                    onClick={ec2.fetchData}
                    className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-xl text-sm font-medium transition-colors"
                >
                    🔄 ลองใหม่อีกครั้ง
                </button>
            </div>
        );
    }

    return (
        <div className="animate-fadeInUp">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* Left: Configuration Panel */}
                <div className="lg:col-span-4 space-y-5">

                    {/* Instance Configuration */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow">
                        <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
                            <div className="bg-blue-100 p-1.5 rounded-lg">
                                <span className="text-blue-600 text-lg">⚙️</span>
                            </div>
                            ตั้งค่าอินสแตนซ์
                            <span className="ml-auto text-[10px] text-gray-400 font-normal bg-gray-100 px-2 py-0.5 rounded-full">
                                {ec2.filteredInstances.length} types
                            </span>
                        </h2>

                        <div className="space-y-3.5">
                            {/* Region */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">🌐 ภูมิภาค (Region)</label>
                                <select
                                    value={ec2.region}
                                    onChange={e => ec2.setRegion(e.target.value)}
                                    className="w-full rounded-xl border-gray-300 border p-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white"
                                >
                                    {ec2.regions.map(r => (
                                        <option key={r} value={r}>{REGION_NAMES[r] || r} [{r}]</option>
                                    ))}
                                </select>
                            </div>

                            {/* OS */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">🖥️ ระบบปฏิบัติการ (OS)</label>
                                <select
                                    value={ec2.os}
                                    onChange={e => ec2.setOs(e.target.value)}
                                    className="w-full rounded-xl border-gray-300 border p-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white"
                                >
                                    <option value="Linux">Linux</option>
                                    <option value="Windows">Windows</option>
                                    <option value="RHEL">RHEL (Red Hat)</option>
                                    <option value="SUSE">SUSE</option>
                                </select>
                            </div>

                            {/* Family Filter */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">🔽 ตระกูล (Instance Family)</label>
                                <select
                                    value={ec2.family}
                                    onChange={e => ec2.setFamily(e.target.value)}
                                    className="w-full rounded-xl border-gray-300 border p-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-white"
                                >
                                    <option value="all">ทั้งหมด (All Families)</option>
                                    {ec2.families.map(f => (
                                        <option key={f} value={f}>{f} ({f.toUpperCase()})</option>
                                    ))}
                                </select>
                            </div>

                            {/* Instance Type Search */}
                            <div className="relative">
                                <label className="block text-sm font-medium text-gray-700 mb-1">🔲 ประเภท (Instance Type)</label>
                                <div className="relative">
                                    <input
                                        ref={searchRef}
                                        type="text"
                                        placeholder="ค้นหา instance type... (↑↓ เลือก, Enter ยืนยัน)"
                                        value={ec2.searchQuery}
                                        onChange={e => { ec2.setSearchQuery(e.target.value); setShowDropdown(true); }}
                                        onFocus={() => setShowDropdown(true)}
                                        onKeyDown={handleSearchKeyDown}
                                        autoComplete="off"
                                        className="w-full rounded-xl border-gray-300 border p-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all pr-8"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                                </div>

                                {/* Dropdown */}
                                {showDropdown && (
                                    <div ref={dropdownRef} className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-[280px] overflow-y-auto instance-dropdown">
                                        {ec2.searchResults.length === 0 ? (
                                            <div className="p-4 text-center text-gray-400 text-sm">ไม่พบ instance type ที่ตรง</div>
                                        ) : (
                                            ec2.searchResults.map((inst, idx) => (
                                                <div
                                                    key={inst.name}
                                                    data-instance-option
                                                    onClick={() => { ec2.selectInstance(inst.name); setShowDropdown(false); setHighlightIndex(-1); }}
                                                    className={`px-3 py-2.5 cursor-pointer flex justify-between items-center gap-2 text-sm transition-colors ${idx === highlightIndex
                                                            ? 'bg-blue-50 border-l-[3px] border-blue-500'
                                                            : ec2.selectedInstance?.name === inst.name
                                                                ? 'bg-blue-50/50'
                                                                : 'hover:bg-gray-50'
                                                        }`}
                                                >
                                                    <div>
                                                        <span className="font-medium text-gray-900">{inst.name}</span>
                                                        {!inst.currentGen && <span className="text-xs text-amber-600 ml-1">(prev gen)</span>}
                                                        <div className="text-xs text-gray-400 mt-0.5">{inst.vcpu} vCPUs • {inst.memory}</div>
                                                    </div>
                                                    <span className="text-xs font-medium text-blue-600 whitespace-nowrap">${inst.price.toFixed(4)}/hr</span>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Instance Specs */}
                            {ec2.selectedInstance && (
                                <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 animate-fadeInUp">
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-blue-500">🔲</span>
                                            <span className="text-gray-500">vCPU:</span>
                                            <span className="font-medium">{ec2.selectedInstance.vcpu}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-purple-500">💾</span>
                                            <span className="text-gray-500">RAM:</span>
                                            <span className="font-medium">{ec2.selectedInstance.memory}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-orange-500">💿</span>
                                            <span className="text-gray-500">Storage:</span>
                                            <span className="font-medium">{ec2.selectedInstance.storage}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-green-500">📶</span>
                                            <span className="text-gray-500">Network:</span>
                                            <span className="font-medium">{ec2.selectedInstance.network}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Pricing Model Tabs */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">🏷️ รูปแบบราคา (Pricing Model)</label>
                                <div className="grid grid-cols-2 gap-1.5">
                                    {(Object.entries(PRICING_MODELS) as [PricingModelKey, typeof PRICING_MODELS[PricingModelKey]][]).map(([key, model]) => (
                                        <button
                                            key={key}
                                            type="button"
                                            onClick={() => ec2.setSelectedModel(key)}
                                            className={`rounded-lg px-3 py-2 text-xs font-medium text-center transition-all ${ec2.selectedModel === key
                                                ? 'bg-blue-800 text-white shadow-md'
                                                : 'bg-gray-100 text-gray-600 hover:bg-blue-50'
                                                }`}
                                        >
                                            {key === 'ondemand' ? 'On-Demand' : key === 'ri1yr' ? 'RI 1 ปี' : key === 'ri3yr' ? 'RI 3 ปี' : 'Savings Plan'}
                                            {key !== 'ondemand' && (
                                                <span className="ml-1 bg-emerald-500 text-white text-[10px] px-1.5 py-0.5 rounded font-semibold">
                                                    -{((1 - model.discount) * 100).toFixed(0)}%
                                                </span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Quantity & Hours with Presets */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">จำนวน</label>
                                    <input
                                        type="number"
                                        min={1}
                                        value={ec2.quantity}
                                        onChange={e => ec2.setQuantity(parseInt(e.target.value) || 1)}
                                        className="w-full rounded-xl border-gray-300 border p-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">ชม./เดือน</label>
                                    <input
                                        type="number"
                                        min={1}
                                        max={730}
                                        value={ec2.hours}
                                        onChange={e => ec2.setHours(parseInt(e.target.value) || 730)}
                                        className="w-full rounded-xl border-gray-300 border p-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                    />
                                </div>
                            </div>

                            {/* Hour Presets */}
                            <div className="flex gap-1.5">
                                {HOUR_PRESETS.map(preset => (
                                    <button
                                        key={preset.value}
                                        type="button"
                                        onClick={() => ec2.setHours(preset.value)}
                                        className={`flex-1 text-center py-1.5 rounded-lg text-[10px] font-medium transition-all ${ec2.hours === preset.value
                                                ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-300'
                                                : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                                            }`}
                                        title={preset.desc}
                                    >
                                        {preset.label}
                                        <div className="text-[9px] font-normal opacity-70">{preset.value}h</div>
                                    </button>
                                ))}
                            </div>

                            {/* Live Price Preview */}
                            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
                                <p className="text-xs text-blue-700 mb-0.5">ราคาประเมินต่อเดือน (ต่อ 1 เครื่อง)</p>
                                <p className="text-2xl font-bold text-blue-900">{formatCurrency(ec2.livePreview.monthly)}</p>
                                <p className="text-xs text-blue-600 mt-0.5">(${ec2.livePreview.hourly.toFixed(4)} / ชั่วโมง)</p>
                                <p className="text-xs text-blue-500 mt-1">{PRICING_MODELS[ec2.selectedModel].label}</p>
                            </div>

                            {/* Add Button */}
                            <button
                                type="button"
                                disabled={!ec2.selectedInstance}
                                onClick={handleAddToCart}
                                className={`w-full font-medium py-3 px-4 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] ${addFlash
                                    ? 'bg-green-600 text-white'
                                    : ec2.selectedInstance
                                        ? 'bg-gray-900 hover:bg-gray-800 text-white hover:shadow-lg'
                                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                    }`}
                            >
                                {addFlash ? '✓ เพิ่มแล้ว!' : '➕ เพิ่มลงในรายการประเมิน'}
                            </button>
                        </div>
                    </div>

                    {/* Pricing Comparison */}
                    {ec2.selectedInstance && ec2.pricingComparison.length > 0 && (
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 animate-fadeInUp">
                            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                <div className="bg-green-100 p-1.5 rounded-lg">
                                    <span className="text-green-600 text-lg">📊</span>
                                </div>
                                เปรียบเทียบราคา (ต่อเดือน / 1 เครื่อง)
                            </h3>
                            <div className="space-y-2">
                                {ec2.pricingComparison.map(item => (
                                    <div
                                        key={item.key}
                                        onClick={() => ec2.setSelectedModel(item.key as PricingModelKey)}
                                        className={`rounded-lg px-3 py-2.5 flex justify-between items-center transition-all border-2 cursor-pointer ${item.key === ec2.selectedModel
                                                ? 'border-blue-400 bg-blue-50 ring-1 ring-blue-200'
                                                : item.key === 'ri3yr'
                                                    ? 'border-green-300 bg-gradient-to-r from-green-50 to-emerald-50 hover:border-green-400'
                                                    : 'border-transparent bg-gray-50 hover:border-blue-200'
                                            }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full ${item.key === ec2.selectedModel ? 'bg-blue-500' : 'bg-gray-300'}`} />
                                            <div>
                                                <span className="text-xs font-medium text-gray-700">{item.label}</span>
                                                {item.key !== 'ondemand' && (
                                                    <span className="ml-1 bg-emerald-500 text-white text-[10px] px-1.5 py-0.5 rounded font-semibold">
                                                        -{item.savings}%
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className={`text-sm font-bold ${item.key === 'ri3yr' ? 'text-green-700' : 'text-gray-900'}`}>
                                                {formatCurrency(item.monthly)}
                                            </span>
                                            <div className="text-xs text-gray-400">${item.hourly.toFixed(4)}/hr</div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Savings summary */}
                            {ec2.selectedModel !== 'ondemand' && (
                                <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-emerald-700 bg-emerald-50 rounded-lg p-2.5 flex items-center gap-2">
                                    <span className="text-lg">💰</span>
                                    <div>
                                        ประหยัดได้ <strong>{formatCurrency(
                                            (ec2.pricingComparison[0]?.monthly || 0) - ec2.livePreview.monthly
                                        )}</strong>/เดือน เมื่อเทียบกับ On-Demand
                                    </div>
                                </div>
                            )}

                            {/* Stopped Instance Info */}
                            <div className="mt-3 pt-3 border-t border-gray-100">
                                <div className="flex items-start gap-2 text-xs text-gray-500">
                                    <span className="text-amber-500 mt-0.5 flex-shrink-0">ℹ️</span>
                                    <div>
                                        <span className="font-medium text-gray-700">Stopped Instance:</span>{' '}
                                        ไม่มีค่า Compute แต่ยังมีค่า EBS Storage (~$0.10/GB/เดือน)
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right: Estimate Summary */}
                <div className="lg:col-span-8 space-y-5">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col min-h-[500px]">
                        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h2 className="text-base font-semibold flex items-center gap-2">
                                <div className="bg-emerald-100 p-1.5 rounded-lg">
                                    <span className="text-emerald-600 text-lg">📋</span>
                                </div>
                                รายการประเมินราคา
                                {ec2.cart.length > 0 && (
                                    <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-medium">
                                        {ec2.cart.length} รายการ
                                    </span>
                                )}
                            </h2>
                            <div className="flex items-center gap-2">
                                {ec2.cart.length > 0 && (
                                    <>
                                        <button
                                            onClick={ec2.exportCartCSV}
                                            className="text-xs text-blue-500 hover:text-blue-700 font-medium transition-colors flex items-center gap-1 hover:bg-blue-50 px-3 py-1.5 rounded-lg"
                                            title="Export เป็นไฟล์ CSV"
                                        >
                                            📥 Export CSV
                                        </button>
                                        <button
                                            onClick={() => { if (confirm('คุณต้องการล้างรายการประเมินทั้งหมดใช่หรือไม่?')) ec2.clearCart(); }}
                                            className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors flex items-center gap-1 hover:bg-red-50 px-3 py-1.5 rounded-lg"
                                        >
                                            🗑️ ล้างทั้งหมด
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Table */}
                        <div className="p-0 overflow-x-auto flex-grow">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 text-gray-500 text-xs border-b border-gray-200 uppercase tracking-wider">
                                        <th className="p-3.5 font-medium">รายละเอียด</th>
                                        <th className="p-3.5 font-medium text-center">รูปแบบ</th>
                                        <th className="p-3.5 font-medium text-center">จำนวน</th>
                                        <th className="p-3.5 font-medium text-center">ชม./เดือน</th>
                                        <th className="p-3.5 font-medium text-right">ราคา/เดือน</th>
                                        <th className="p-3.5 font-medium text-center w-20"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 text-sm">
                                    {ec2.cart.map(item => (
                                        <tr key={item.id} className="hover:bg-gray-50 transition-colors animate-fadeInUp group">
                                            <td className="p-3.5">
                                                <div className="font-medium text-gray-900">{item.type}</div>
                                                <div className="text-xs text-gray-400 mt-0.5">{item.os} • {item.region}</div>
                                                <div className="text-xs text-gray-400">{item.specs}</div>
                                            </td>
                                            <td className="p-3.5 text-center">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${MODEL_BADGE_COLORS[item.model]}`}>
                                                    {MODEL_SHORT_LABELS[item.model]}
                                                </span>
                                            </td>
                                            <td className="p-3.5 text-center">
                                                <div className="inline-flex items-center gap-1">
                                                    <button
                                                        onClick={() => ec2.updateCartItemQty(item.id, item.qty - 1)}
                                                        disabled={item.qty <= 1}
                                                        className="w-5 h-5 rounded text-xs bg-gray-100 hover:bg-gray-200 disabled:opacity-30 disabled:hover:bg-gray-100 transition-colors flex items-center justify-center"
                                                    >
                                                        −
                                                    </button>
                                                    <span className="inline-flex items-center justify-center px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-medium text-xs min-w-[28px]">
                                                        x{item.qty}
                                                    </span>
                                                    <button
                                                        onClick={() => ec2.updateCartItemQty(item.id, item.qty + 1)}
                                                        className="w-5 h-5 rounded text-xs bg-gray-100 hover:bg-gray-200 transition-colors flex items-center justify-center"
                                                    >
                                                        +
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="p-3.5 text-center text-gray-500 text-xs">{item.hours}</td>
                                            <td className="p-3.5 text-right">
                                                <div className="font-semibold text-gray-900">{formatCurrency(item.total)}</div>
                                                <div className="text-xs text-gray-400">${item.hourlyRate.toFixed(4)}/hr</div>
                                            </td>
                                            <td className="p-3.5 text-center">
                                                <div className="flex items-center justify-center gap-0.5 opacity-40 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => ec2.duplicateCartItem(item.id)}
                                                        className="text-gray-400 hover:text-blue-500 transition-colors p-1 rounded-lg hover:bg-blue-50"
                                                        title="คัดลอกรายการ"
                                                    >
                                                        📋
                                                    </button>
                                                    <button
                                                        onClick={() => ec2.removeFromCart(item.id)}
                                                        className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded-lg hover:bg-red-50"
                                                        title="ลบรายการ"
                                                    >
                                                        🗑️
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {/* Empty State */}
                            {ec2.cart.length === 0 && (
                                <div className="p-16 text-center text-gray-400 flex flex-col items-center">
                                    <div className="bg-gray-100 p-4 rounded-2xl mb-4">
                                        <span className="text-4xl">🛒</span>
                                    </div>
                                    <p className="font-medium text-gray-500">ยังไม่มีรายการในตารางประเมิน</p>
                                    <p className="text-xs mt-1.5 text-gray-400">เลือก Instance Type ด้านซ้ายแล้วกด &quot;เพิ่มลงในรายการประเมิน&quot;</p>
                                    <p className="text-xs mt-1 text-gray-400">💡 รายการจะถูกบันทึกอัตโนมัติ แม้ปิดหน้าเว็บก็ไม่หาย</p>
                                </div>
                            )}
                        </div>

                        {/* Grand Total */}
                        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-5 mt-auto relative overflow-hidden">
                            <div className="absolute inset-0 opacity-10">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-green-400 rounded-full blur-2xl" />
                            </div>
                            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 relative z-10">
                                <div>
                                    <p className="text-gray-400 text-sm">ยอดรวมประเมินรายเดือน (Total Estimated Monthly Cost)</p>
                                    <p className="text-xs text-gray-500 mt-0.5">* ราคาประมาณการ ไม่รวมภาษี, Data Transfer, EBS Volume</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-3xl font-bold tracking-tight text-emerald-400">{formatCurrency(ec2.grandTotal)}</p>
                                    <p className="text-xs text-gray-400">USD / Month</p>
                                    {ec2.grandTotal > 0 && (
                                        <p className="text-xs text-gray-500 mt-0.5">~{formatCurrency(ec2.grandTotal * 12)} / Year</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
