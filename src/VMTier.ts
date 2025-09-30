import { VmUpdateSpecsRequest } from "./api-clients/csb";

/**
 * A VM tier is how we classify the specs of a VM. You can use this to request a VM with specific
 * specs.
 *
 * You can either get a tier by its name, or by specifying the minimum specs you need.
 *
 * ## Example
 *
 * ```ts
 * const tier = VMTier.Pico;
 * ```
 *
 * ```ts
 * const tier = VMTier.fromSpecs(16, 32, 40);
 * ```
 */
export class VMTier {
  /** 1 CPU, 2GiB RAM */
  public static readonly Pico = new VMTier("Pico", 1, 2, 20);
  /** 2 CPU, 4GiB RAM */
  public static readonly Nano = new VMTier("Nano", 2, 4, 20);
  /** 4 CPU, 8GiB RAM */
  public static readonly Micro = new VMTier("Micro", 4, 8, 20);
  /** 8 CPU, 16GiB RAM */
  public static readonly Small = new VMTier("Small", 8, 16, 30);
  /** 16 CPU, 32GiB RAM */
  public static readonly Medium = new VMTier("Medium", 16, 32, 40);
  /** 32 CPU, 64GiB RAM */
  public static readonly Large = new VMTier("Large", 32, 64, 50);
  /** 64 CPU, 128GiB RAM */
  public static readonly XLarge = new VMTier("XLarge", 64, 128, 50);

  public static readonly All = [
    VMTier.Pico,
    VMTier.Nano,
    VMTier.Micro,
    VMTier.Small,
    VMTier.Medium,
    VMTier.Large,
    VMTier.XLarge,
  ];

  private constructor(
    public readonly name: VmUpdateSpecsRequest["tier"],
    public readonly cpuCores: number,
    public readonly memoryGiB: number,
    public readonly diskGB: number
  ) {}

  public static fromName(name: VmUpdateSpecsRequest["tier"]): VMTier {
    return VMTier[name];
  }

  /**
   * Returns the tier that complies to the given minimum specs.
   * @param cpuCores Amount of CPU cores needed
   * @param memoryGiB Amount of memory needed in GiB
   * @param diskGB Amount of disk space needed in GB
   */
  public static fromSpecs(specs: {
    cpu: number;
    memGiB: number;
    diskGB?: number;
  }): VMTier | undefined {
    return Object.values(VMTier).find(
      (tier) =>
        tier.cpuCores >= specs.cpu &&
        tier.memoryGiB >= specs.memGiB &&
        (specs.diskGB === undefined || tier.diskGB >= specs.diskGB)
    );
  }
}
