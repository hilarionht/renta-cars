export interface BoundedContextGeneratorSchema {
  name: string;
  scope: 'platform' | 'product-rental';
  skipDomain?: boolean;
}
