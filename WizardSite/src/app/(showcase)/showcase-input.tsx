import { SearchBar } from "@/components/search/search-bar";

/**
 * The real, brand-styled input — routes a pasted link straight into the live
 * results flow so the judge demo runs end-to-end (paste → ranked twins).
 */
export function ShowcaseInput() {
  return <SearchBar />;
}
