import os from "node:os";
import fs from "node:fs";
import { execSync } from "node:child_process";
import type { GpuInfo, HardwareProfile, CpuInfo, MemoryInfo, OsInfo } from "./types.ts";

// Detect operating system details
export function getOsInfo(): OsInfo {
  return {
    platform: process.platform,
    type: os.type(),
    release: os.release(),
    arch: os.arch(),
    hostname: os.hostname(),
    uptimeSec: Math.round(os.uptime()),
  };
}

// Detect CPU cores and model
export function getCpuInfo(): CpuInfo {
  const cpus = os.cpus();
  return {
    model: cpus[0]?.model || "Unknown CPU",
    cores: cpus.length,
    speedMHz: cpus[0]?.speed || 0,
  };
}

// Detect system RAM
export function getMemoryInfo(): MemoryInfo {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  return {
    totalGB: Math.round((total / 1024 / 1024 / 1024) * 10) / 10,
    freeGB: Math.round((free / 1024 / 1024 / 1024) * 10) / 10,
    usedGB: Math.round((used / 1024 / 1024 / 1024) * 10) / 10,
    usagePercent: Math.round((used / total) * 100),
  };
}

// Detect GPU & VRAM using nvidia-smi or Windows WMI
export function getGpuInfo(): GpuInfo | undefined {
  // Try nvidia-smi first across Windows and Linux
  try {
    const output = execSync(
      "nvidia-smi --query-gpu=name,memory.total,memory.free,driver_version --format=csv,noheader,nounits",
      { stdio: "pipe", timeout: 2000 },
    ).toString().trim();

    if (output) {
      const parts = output.split(",").map((s) => s.trim());
      if (parts.length >= 3) {
        return {
          name: parts[0],
          totalVramMB: parseInt(parts[1], 10) || 0,
          freeVramMB: parseInt(parts[2], 10) || 0,
          driverVersion: parts[3],
        };
      }
    }
  } catch {
    // nvidia-smi not found or non-NVIDIA GPU
  }

  // Windows fallback via PowerShell WMI
  if (process.platform === "win32") {
    try {
      const psCmd =
        'powershell.exe -NoProfile -Command "Get-CimInstance Win32_VideoController | Select-Object -First 1 Name, AdapterRAM | ConvertTo-Json"';
      const output = execSync(psCmd, { stdio: "pipe", timeout: 3000 }).toString().trim();
      if (output) {
        const parsed = JSON.parse(output);
        const totalMB = Math.round((parsed.AdapterRAM || 0) / 1024 / 1024);
        return {
          name: parsed.Name || "Integrated / Generic GPU",
          totalVramMB: totalMB > 0 ? totalMB : 0,
          freeVramMB: totalMB > 0 ? Math.round(totalMB * 0.75) : 0,
        };
      }
    } catch {
      // WMI unavailable
    }
  }

  return undefined;
}

// Detect workspace disk availability
export function getDiskInfo(): { workspaceDrive: string; freeGB?: number } {
  const cwd = process.cwd();
  const drive = process.platform === "win32" ? cwd.slice(0, 2) : "/";
  try {
    if (process.platform === "win32") {
      const psCmd = `powershell.exe -NoProfile -Command "Get-PSDrive ${drive[0]} | Select-Object Free | ConvertTo-Json"`;
      const output = execSync(psCmd, { stdio: "pipe", timeout: 2000 }).toString().trim();
      if (output) {
        const parsed = JSON.parse(output);
        return {
          workspaceDrive: drive,
          freeGB: Math.round(((parsed.Free || 0) / 1024 / 1024 / 1024) * 10) / 10,
        };
      }
    }
  } catch {
    // Disk inspect fallback
  }

  return { workspaceDrive: drive };
}

// Detect network status
export function getNetworkInfo(): { isOnline: boolean; primaryIp?: string } {
  const ifaces = os.networkInterfaces();
  let primaryIp: string | undefined;

  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name] || []) {
      if (iface.family === "IPv4" && !iface.internal) {
        primaryIp = iface.address;
        break;
      }
    }
    if (primaryIp) break;
  }

  return {
    isOnline: Boolean(primaryIp),
    primaryIp,
  };
}

// Collect raw hardware and environment facts without making model decisions
export function detectHardwareProfile(): HardwareProfile {
  const mem = process.memoryUsage();
  return {
    os: getOsInfo(),
    cpu: getCpuInfo(),
    memory: getMemoryInfo(),
    gpu: getGpuInfo(),
    disk: getDiskInfo(),
    network: getNetworkInfo(),
    runtime: {
      name: "Bun",
      version: process.versions.bun || "1.4.0",
      nodeVersion: process.version,
      pid: process.pid,
      memoryRssMB: Math.round((mem.rss / 1024 / 1024) * 10) / 10,
      memoryHeapMB: Math.round((mem.heapUsed / 1024 / 1024) * 10) / 10,
    },
  };
}
