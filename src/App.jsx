import Admin from './Admin'
import './App.css'
import './ProductCatalog.css'
import './ProductCatalogSearch.css'
import './CartCheckout.css'
import './BrandLogo.css'
import './StoreButtonPolish.css'
import ClothingStore from './ClothingStore'

export default function App() {
  const path = window.location.pathname.replace(/\/index\.html$/, '/').replace(/\/+$/, '') || '/'
  return path === '/admin' ? <Admin /> : <ClothingStore />
}
