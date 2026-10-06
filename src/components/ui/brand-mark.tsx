/** Project Camera logo: a screen in perspective with its focus point. Same path as public/brand/logo.svg. */
const BRAND_MARK_PATH =
  'M0 12C0 3.809 8.024 -1.974 15.795 0.616L67.897 17.983C70.347 18.8 72 21.093 72 23.675L72 63.026C72 65.609 70.347 67.902 67.897 68.718L15.795 86.086C8.024 88.676 0 82.892 0 74.702ZM12 10.351L66 23.851L66 62.851L12 76.351ZM56.874 43.351C56.874 51.493 52.45 58.094 46.994 58.094C41.537 58.094 37.113 51.493 37.113 43.351C37.113 35.208 41.537 28.608 46.994 28.608C52.45 28.608 56.874 35.208 56.874 43.351Z';
const BRAND_MARK_RATIO = 72 / 86.702;

export function BrandMark({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size * BRAND_MARK_RATIO}
      height={size}
      viewBox="0 0 72 86.702"
      fill="currentColor"
      aria-hidden="true"
    >
      <path fillRule="evenodd" d={BRAND_MARK_PATH} />
    </svg>
  );
}
