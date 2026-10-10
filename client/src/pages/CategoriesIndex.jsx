/** All categories, grouped by what they sell. */
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import CategoryCard from '../components/CategoryCard.jsx';
import { Breadcrumbs, Skeleton, Section } from '../components/ui/index.jsx';

export default function CategoriesIndex() {
  const { categories, phase } = useApp();
  const loading = phase === 'loading';

  const grocery = categories.filter((c) => !c.isFood);
  const food = categories.filter((c) => c.isFood);

  return (
    <div className="container page">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Categories' }]} />
      <h1 className="mb-2">All categories</h1>
      <p className="muted mb-5">Everything Food Express delivers, from staples to electronics.</p>

      {loading ? (
        <div className="cat-grid">
          {Array.from({ length: 10 }, (_, i) => <Skeleton key={i} style={{ height: 108 }} />)}
        </div>
      ) : (
        <>
          {food.length > 0 && (
            <Section title="Food & restaurants" subtitle="Order from kitchens near you" to="/restaurants" linkLabel="All restaurants">
              <div className="cat-grid">
                {food.map((c) => <CategoryCard key={c.slug} category={c} />)}
              </div>
            </Section>
          )}

          <Section title="Shopping" subtitle="Groceries, essentials and more">
            <div className="cat-grid">
              {grocery.map((c) => <CategoryCard key={c.slug} category={c} />)}
            </div>
          </Section>

          <Section title="Quick links">
            <div className="chips">
              <Link className="chip" to="/search?maxPrice=99">Under ₹99</Link>
              <Link className="chip" to="/search?tag=bestseller">Best sellers</Link>
              <Link className="chip" to="/search?tag=new">New arrivals</Link>
              <Link className="chip" to="/search?tag=healthy">Healthy picks</Link>
              <Link className="chip" to="/search?discount=true">Discounted items</Link>
              <Link className="chip" to="/search?sort=rating">Top rated</Link>
            </div>
          </Section>
        </>
      )}
    </div>
  );
}
