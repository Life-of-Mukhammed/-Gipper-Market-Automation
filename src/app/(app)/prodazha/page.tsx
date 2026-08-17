import { PosScreen } from "./pos-screen";

// Deliberately does not preload the product/client catalog here — with a
// large catalog that fetch alone can take seconds and would block the
// whole page. PosScreen searches on demand instead and builds its offline
// cache in the background after the page is already interactive.
export default function ProdazhaPage() {
  return <PosScreen />;
}
