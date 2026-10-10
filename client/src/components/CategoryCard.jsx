/** Category shortcut tile — links to the real category listing page. */
import { Link } from 'react-router-dom';

export default function CategoryCard({ category }) {
  const color = category.color || '#0f7a4f';
  return (
    <Link to={`/category/${category.slug}`} className="cat-card" aria-label={`${category.name}, ${category.productCount} products`}>
      <span className="cat-icon" style={{ background: `${color}1a`, color }} aria-hidden="true">
        {category.icon || '🛒'}
      </span>
      <span className="cat-name">{category.name}</span>
      <span className="cat-count">{category.productCount} items</span>
    </Link>
  );
}

export function CategoryGrid({ categories }) {
  return (
    <div className="cat-grid">
      {categories.map((c) => <CategoryCard key={c.slug} category={c} />)}
    </div>
  );
}
