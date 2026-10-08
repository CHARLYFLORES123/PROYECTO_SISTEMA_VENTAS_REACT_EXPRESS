type ProductLabelParts = {
  name: string;
  size?: string | null;
  color?: string | null;
};

export function formatProductLabel(product: ProductLabelParts) {
  return [
    product.name,
    product.size && `Talla ${product.size}`,
    product.color && `Color ${product.color}`,
  ].filter(Boolean).join(" · ");
}
