// Copied from coss-main/packages/ui/src/lib/utils.ts; AGPL-3.0-or-later.
// License: ../components/ui/LICENSE.coss-ui.txt.
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
