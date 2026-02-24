import { PricingModel, PricingModelKey } from '@/types/ec2';

export const API_URL = 'https://tedivm.github.io/ec2details/api/ec2instances.json';

export const PRICING_MODELS: Record<PricingModelKey, PricingModel> = {
    ondemand: { label: 'On-Demand', discount: 1.0, color: 'blue' },
    ri1yr: { label: 'Reserved 1 ปี (No Upfront)', discount: 0.69, color: 'purple' },
    ri3yr: { label: 'Reserved 3 ปี (All Upfront)', discount: 0.45, color: 'indigo' },
    sp: { label: 'Savings Plan (Compute)', discount: 0.63, color: 'green' },
};

export const REGION_NAMES: Record<string, string> = {
    'af-south-1': 'Africa (Cape Town)',
    'ap-east-1': 'Asia Pacific (Hong Kong)',
    'ap-northeast-1': 'Asia Pacific (Tokyo)',
    'ap-northeast-2': 'Asia Pacific (Seoul)',
    'ap-northeast-3': 'Asia Pacific (Osaka)',
    'ap-south-1': 'Asia Pacific (Mumbai)',
    'ap-south-2': 'Asia Pacific (Hyderabad)',
    'ap-southeast-1': 'Asia Pacific (Singapore)',
    'ap-southeast-2': 'Asia Pacific (Sydney)',
    'ap-southeast-3': 'Asia Pacific (Jakarta)',
    'ap-southeast-4': 'Asia Pacific (Melbourne)',
    'ca-central-1': 'Canada (Central)',
    'eu-central-1': 'Europe (Frankfurt)',
    'eu-central-2': 'Europe (Zurich)',
    'eu-north-1': 'Europe (Stockholm)',
    'eu-south-1': 'Europe (Milan)',
    'eu-south-2': 'Europe (Spain)',
    'eu-west-1': 'Europe (Ireland)',
    'eu-west-2': 'Europe (London)',
    'eu-west-3': 'Europe (Paris)',
    'il-central-1': 'Israel (Tel Aviv)',
    'me-central-1': 'Middle East (UAE)',
    'me-south-1': 'Middle East (Bahrain)',
    'sa-east-1': 'South America (São Paulo)',
    'us-east-1': 'US East (N. Virginia)',
    'us-east-2': 'US East (Ohio)',
    'us-west-1': 'US West (N. California)',
    'us-west-2': 'US West (Oregon)',
    'us-gov-east-1': 'AWS GovCloud (US-East)',
    'us-gov-west-1': 'AWS GovCloud (US-West)',
};

export const PRIORITY_REGIONS = ['ap-southeast-1', 'us-east-1', 'us-west-2', 'eu-west-1', 'ap-northeast-1'];

export const MODEL_BADGE_COLORS: Record<PricingModelKey, string> = {
    ondemand: 'bg-blue-100 text-blue-700',
    ri1yr: 'bg-purple-100 text-purple-700',
    ri3yr: 'bg-indigo-100 text-indigo-700',
    sp: 'bg-green-100 text-green-700',
};

export const MODEL_SHORT_LABELS: Record<PricingModelKey, string> = {
    ondemand: 'OD',
    ri1yr: 'RI-1Y',
    ri3yr: 'RI-3Y',
    sp: 'SP',
};
