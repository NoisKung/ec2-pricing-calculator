export interface EC2InstanceData {
  clockSpeed?: string;
  currentGeneration?: boolean;
  dedicatedEbsThroughput?: string;
  enhancedNetworkingSupported?: boolean;
  memory: string;
  networkPerformance: string;
  normalizationSizeFactor?: number;
  physicalProcessor?: string;
  prices: Record<string, Record<string, Record<string, number>>>;
  regions: string[];
  storage: string;
  vcpu: number;
  ecu?: number;
}

export interface EC2DataMap {
  [instanceName: string]: EC2InstanceData;
}

export interface FilteredInstance {
  name: string;
  family: string;
  vcpu: number | string;
  memory: string;
  storage: string;
  network: string;
  price: number;
  currentGen: boolean;
}

export interface CartItem {
  id: string;
  region: string;
  regionId: string;
  os: string;
  type: string;
  specs: string;
  model: PricingModelKey;
  modelLabel: string;
  qty: number;
  hours: number;
  hourlyRate: number;
  total: number;
}

export type PricingModelKey = 'ondemand' | 'ri1yr' | 'ri3yr' | 'sp';

export interface PricingModel {
  label: string;
  discount: number;
  color: string;
}
