// GPU and VRAM hardware facts
export interface GpuInfo {
  name: string;
  totalVramMB: number;
  freeVramMB: number;
  driverVersion?: string;
}

// CPU hardware facts
export interface CpuInfo {
  model: string;
  cores: number;
  speedMHz: number;
}

// Memory hardware facts
export interface MemoryInfo {
  totalGB: number;
  freeGB: number;
  usedGB: number;
  usagePercent: number;
}

// OS platform facts
export interface OsInfo {
  platform: string;
  type: string;
  release: string;
  arch: string;
  hostname: string;
  uptimeSec: number;
}

// Full hardware profile containing pure facts without business decisions
export interface HardwareProfile {
  os: OsInfo;
  cpu: CpuInfo;
  memory: MemoryInfo;
  gpu?: GpuInfo;
  disk: {
    workspaceDrive: string;
    freeGB?: number;
  };
  network: {
    isOnline: boolean;
    primaryIp?: string;
  };
  runtime: {
    name: string;
    version: string;
    nodeVersion: string;
    pid: number;
    memoryRssMB: number;
    memoryHeapMB: number;
  };
}
