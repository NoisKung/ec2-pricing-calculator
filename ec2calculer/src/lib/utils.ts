export function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount);
}

export function isValidRegionCode(region: string): boolean {
    return /^[a-z]{2}-[a-z]+-\d+/.test(region) || region.startsWith('us-gov');
}
