import { useParams } from 'react-router';
import { CarsIndex } from './parts/CarsIndex';
import { MakeView } from './parts/MakeView';
import { ModelView } from './parts/ModelView';

/**
 * Shopping by car: /cars (every make), /cars/:make (its models by body type) and
 * /cars/:make/:model (choose the generation, then the parts that fit it).
 */
export default function CarsPage() {
  const { make, model } = useParams();
  if (make && model) return <ModelView key={`${make}/${model}`} makeSlug={make} modelSlug={model} />;
  if (make) return <MakeView key={make} makeSlug={make} />;
  return <CarsIndex />;
}
