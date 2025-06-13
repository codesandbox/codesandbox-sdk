// This isn't really great, I'm no TS guru, but at least it adds some type safety
export type NestedKey<O> = {
  [K in Extract<keyof O, string>]: O[K] extends Array<any>
    ? K
    : O[K] extends any
    ? `${K}` | `${K}.${NestedKey<O[K]>}`
    : K;
}[Extract<keyof O, string>];
